/**
 * Orchestrateur — rapports mensuels par utilisateur (review de portefeuille).
 * Planifié le 1er de chaque mois (cron) pour le MOIS PRÉCÉDENT.
 *
 * Approche « hybride » : tous les CHIFFRES sont dérivés des données réelles
 * (paper trading, fondamentaux, événements) ; le LLM (DeepSeek→Mistral, sinon
 * repli déterministe) ne fait que RÉDIGER à partir de ces faits fournis — il
 * n'a jamais accès libre à la base et ne doit inventer aucun chiffre.
 *
 * Mode « génération seule » : écrit report_json dans monthly_reports.
 * report_url et sent_at restent null (aucun PDF/email ici — branchable ensuite
 * via l'infra notifications). Idempotent sur (user_id, month).
 */

import { getSupabase } from '../persistence/supabase.js';
import { ReportNarrator } from '../services/reportNarrator.js';
import { logger } from '../logger.js';

export interface MonthlyReportRunOptions {
  month?: string; // YYYY-MM ; défaut = mois précédent (mois écoulé).
  dryRun?: boolean; // N'écrit pas en base ; journalise seulement.
}

export interface MonthlyReportRunResult {
  status: 'success' | 'partial' | 'failed';
  usersProcessed: number;
  reportsGenerated: number;
  skipped: number; // utilisateurs sans compte paper trading
  errors: Array<{ userId: string; error: string }>;
  message: string;
}

/** report_json — forme consommée par MonthlyReportViewer (frontend). */
interface ReportJson {
  month: string;
  userName?: string;
  kpis: { pnlTotal: number; pnlPct: number; capitalCurrent: number; capitalInitial: number };
  topSignals: Array<{
    code: string;
    entryPrice: number;
    exitPrice: number;
    entryDate: string;
    exitDate: string;
    pnlPct: number;
    daysHeld: number;
  }>;
  signalNarrative: string;
  fundamentals: Array<{ code: string; per?: number; pb?: number; graham?: number }>;
  events: Array<{ title: string; date: string; impact: string }>;
  eventNarrative: string;
  recommendations: string;
}

type Supa = ReturnType<typeof getSupabase>;

/**
 * Construit le narrateur en résolvant les clés LLM : table api_keys (comme le
 * frontend) puis variables d'environnement. Sans clé → repli déterministe.
 */
async function resolveNarrator(supabase: Supa): Promise<ReportNarrator> {
  const keys: { deepseek?: string; mistral?: string; grok?: string } = {
    deepseek: process.env.DEEPSEEK_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
    grok: process.env.GROK_API_KEY,
  };
  try {
    const { data } = await supabase.from('api_keys').select('provider, api_key');
    for (const r of (data ?? []) as { provider: string; api_key: string }[]) {
      if (r.provider === 'deepseek' && !keys.deepseek) keys.deepseek = r.api_key;
      if (r.provider === 'mistral' && !keys.mistral) keys.mistral = r.api_key;
      if (r.provider === 'grok' && !keys.grok) keys.grok = r.api_key;
    }
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'api_keys illisible — repli déterministe possible');
  }
  return new ReportNarrator(keys);
}

export async function runMonthlyReports(
  opts: MonthlyReportRunOptions = {},
): Promise<MonthlyReportRunResult> {
  const supabase = getSupabase();
  const narrator = await resolveNarrator(supabase);
  const month = opts.month || previousMonth(new Date());

  logger.info({ month, dryRun: opts.dryRun }, 'Démarrage génération rapports mensuels');

  const result: MonthlyReportRunResult = {
    status: 'success',
    usersProcessed: 0,
    reportsGenerated: 0,
    skipped: 0,
    errors: [],
    message: '',
  };

  try {
    // Utilisateurs premium (feature réservée). profiles n'a PAS de full_name.
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, is_premium')
      .eq('is_premium', true);
    if (profileError) throw new Error(`Lecture profils premium : ${profileError.message}`);

    const users = (profiles ?? []) as { id: string; email: string | null }[];
    logger.info({ count: users.length }, 'Utilisateurs premium récupérés');

    for (const user of users) {
      try {
        const outcome = await generateReportForUser(supabase, user.id, user.email, month, narrator, opts.dryRun ?? false);
        result.usersProcessed++;
        if (outcome === 'generated') result.reportsGenerated++;
        else result.skipped++;
      } catch (error) {
        logger.error({ userId: user.id, error }, 'Échec génération rapport utilisateur');
        result.status = 'partial';
        result.errors.push({ userId: user.id, error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (result.errors.length === 0) {
      result.message = `${result.reportsGenerated} rapport(s) généré(s), ${result.skipped} ignoré(s) (sans portefeuille)`;
    } else if (result.reportsGenerated > 0) {
      result.message = `${result.reportsGenerated} généré(s), ${result.errors.length} en échec`;
    } else {
      result.status = 'failed';
      result.message = `Aucun rapport généré. ${result.errors.length} échec(s).`;
    }

    logger.info(result, 'Génération rapports mensuels terminée');
    return result;
  } catch (error) {
    logger.error({ error }, 'Génération rapports mensuels échouée');
    result.status = 'failed';
    result.message = error instanceof Error ? error.message : String(error);
    return result;
  }
}

async function generateReportForUser(
  supabase: Supa,
  userId: string,
  email: string | null,
  month: string,
  narrator: ReportNarrator,
  dryRun: boolean,
): Promise<'generated' | 'skipped'> {
  const nextMonth = getNextMonth(month);

  // 1. Compte paper trading (KPIs capital). Sans compte → on ignore.
  const { data: account } = await supabase
    .from('paper_trading_accounts')
    .select('capital_initial, capital_current')
    .eq('user_id', userId)
    .maybeSingle();
  if (!account) {
    logger.info({ userId }, 'Aucun compte paper trading — utilisateur ignoré');
    return 'skipped';
  }

  // 2. Positions FERMÉES durant le mois = les trades de l'utilisateur.
  const { data: closedRaw, error: posErr } = await supabase
    .from('paper_trading_positions')
    .select('code, entry_price, entry_date, exit_price, exit_date, pnl, pnl_pct, days_held')
    .eq('user_id', userId)
    .eq('status', 'closed')
    .gte('exit_date', `${month}-01`)
    .lt('exit_date', `${nextMonth}-01`);
  if (posErr) throw new Error(`Positions : ${posErr.message}`);
  const closed = (closedRaw ?? []) as Array<{
    code: string; entry_price: number | null; entry_date: string; exit_price: number | null;
    exit_date: string | null; pnl: number | null; pnl_pct: number | null; days_held: number | null;
  }>;

  // Top signaux du mois = SES meilleures positions clôturées (par P&L %).
  const topSignals = [...closed]
    .sort((a, b) => (b.pnl_pct ?? 0) - (a.pnl_pct ?? 0))
    .slice(0, 6)
    .map((p) => ({
      code: p.code,
      entryPrice: Number(p.entry_price ?? 0),
      exitPrice: Number(p.exit_price ?? p.entry_price ?? 0),
      entryDate: p.entry_date,
      exitDate: p.exit_date ?? p.entry_date,
      pnlPct: Number(p.pnl_pct ?? 0),
      daysHeld: Number(p.days_held ?? 0),
    }));

  // 3. KPIs — P&L RÉALISÉ du mois (somme des clôtures), pas le cumul all-time.
  const pnlTotal = closed.reduce((s, p) => s + Number(p.pnl ?? 0), 0);
  const capitalInitial = Number(account.capital_initial ?? 0);
  const capitalCurrent = Number(account.capital_current ?? 0);
  const pnlPct = capitalInitial > 0 ? (pnlTotal / capitalInitial) * 100 : 0;

  // 4. Fondamentaux DÉRIVÉS (PER/PB/Graham) pour les titres tradés ce mois-ci.
  const codes = [...new Set(topSignals.map((s) => s.code))];
  const valuation = await computeValuation(supabase, codes);
  const fundamentals = codes
    .map((code) => ({ code, ...(valuation.get(code) ?? {}) }))
    .filter((f) => f.per !== undefined || f.pb !== undefined || f.graham !== undefined);

  // 5. Événements du mois — priorité aux titres tradés, sinon marché (importance).
  const events = await loadMonthEvents(supabase, month, nextMonth, codes);

  // 6. Narrations hybrides (faits fournis → prose ; repli déterministe sans clé).
  const signalNarrative = await narrator.narrateSignals(
    topSignals.map((s) => ({ code: s.code, entryPrice: s.entryPrice, exitPrice: s.exitPrice, pnlPct: s.pnlPct, daysHeld: s.daysHeld, fundamentals: valuation.get(s.code) })),
  );
  const eventNarrative = await narrator.narrateEvents(events);
  const topSectors = await getTopSectors(supabase, month, nextMonth);
  const recommendations = await narrator.generateRecommendations(topSectors);

  // 7. Assemblage report_json (forme viewer).
  const reportJson: ReportJson = {
    month,
    userName: email ? email.split('@')[0] : undefined,
    kpis: { pnlTotal, pnlPct, capitalCurrent, capitalInitial },
    topSignals,
    signalNarrative,
    fundamentals,
    events,
    eventNarrative,
    recommendations,
  };

  if (dryRun) {
    logger.info(
      { userId, month, closed: closed.length, pnlTotal, pnlPct: pnlPct.toFixed(2), events: events.length, fundamentals: fundamentals.length },
      'DRY-RUN — rapport non écrit',
    );
    return 'generated';
  }

  // 8. Upsert (génération seule : report_url + sent_at restent null).
  const { error: dbError } = await supabase.from('monthly_reports').upsert(
    { user_id: userId, month, report_json: reportJson, report_url: null, sent_at: null },
    { onConflict: 'user_id,month' },
  );
  if (dbError) throw new Error(`Écriture monthly_reports : ${dbError.message}`);

  logger.info({ userId, month, closed: closed.length }, 'Rapport mensuel généré');
  return 'generated';
}

/**
 * PER / P/B / Graham dérivés honnêtement : dernier exercice de `fundamentals`
 * (net_income, equity) + nombre d'actions (`brvm_instruments.shares`) + dernier
 * cours. Aucune valeur inventée : une métrique n'est fournie que si calculable.
 */
async function computeValuation(
  supabase: Supa,
  codes: string[],
): Promise<Map<string, { per?: number; pb?: number; graham?: number }>> {
  const out = new Map<string, { per?: number; pb?: number; graham?: number }>();
  if (codes.length === 0) return out;

  const [{ data: funds }, { data: instr }, { data: lastDateRow }] = await Promise.all([
    supabase.from('fundamentals').select('code, year, net_income, equity').in('code', codes).order('year', { ascending: false }),
    supabase.from('brvm_instruments').select('code, shares').in('code', codes),
    supabase.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1),
  ]);

  const sharesByCode = new Map<string, number | null>();
  for (const r of (instr ?? []) as { code: string; shares: number | null }[]) sharesByCode.set(r.code, r.shares);

  const fundByCode = new Map<string, { net_income: number | null; equity: number | null }>();
  for (const r of (funds ?? []) as { code: string; net_income: number | null; equity: number | null }[]) {
    if (!fundByCode.has(r.code)) fundByCode.set(r.code, { net_income: r.net_income, equity: r.equity }); // 1er = année la plus récente
  }

  const priceByCode = new Map<string, number | null>();
  const lastDate = (lastDateRow?.[0]?.date_marche as string | undefined) ?? undefined;
  if (lastDate) {
    const { data: quotes } = await supabase
      .from('brvm_actions_daily').select('code, cours_jour').eq('date_marche', lastDate).in('code', codes);
    for (const q of (quotes ?? []) as { code: string; cours_jour: number | null }[]) priceByCode.set(q.code, q.cours_jour);
  }

  for (const code of codes) {
    const shares = sharesByCode.get(code);
    const f = fundByCode.get(code);
    const price = priceByCode.get(code);
    if (!shares || shares <= 0 || !f) continue;
    const metrics: { per?: number; pb?: number; graham?: number } = {};
    const eps = f.net_income != null ? f.net_income / shares : null;
    const bvps = f.equity != null ? f.equity / shares : null;
    if (price != null && eps != null && eps > 0) metrics.per = price / eps;
    if (price != null && bvps != null && bvps > 0) metrics.pb = price / bvps;
    if (eps != null && eps > 0 && bvps != null && bvps > 0) metrics.graham = Math.sqrt(22.5 * eps * bvps);
    if (metrics.per !== undefined || metrics.pb !== undefined || metrics.graham !== undefined) out.set(code, metrics);
  }
  return out;
}

/** Événements du mois : ceux liés aux titres tradés, complétés par les plus importants. */
async function loadMonthEvents(
  supabase: Supa,
  month: string,
  nextMonth: string,
  codes: string[],
): Promise<Array<{ title: string; date: string; impact: string }>> {
  const { data } = await supabase
    .from('market_events')
    .select('title, event_date, event_type, summary, importance_level, instrument_code')
    .gte('event_date', `${month}-01`)
    .lt('event_date', `${nextMonth}-01`)
    .order('importance_level', { ascending: false })
    .limit(40);
  const rows = (data ?? []) as Array<{
    title: string; event_date: string; event_type: string | null; summary: string | null;
    importance_level: number | null; instrument_code: string | null;
  }>;
  const codeSet = new Set(codes);
  const held = rows.filter((e) => e.instrument_code && codeSet.has(e.instrument_code));
  const chosen = (held.length > 0 ? held : rows).slice(0, 6);
  return chosen.map((e) => ({
    title: e.title,
    date: e.event_date,
    impact: e.summary || e.event_type || 'Événement de marché',
  }));
}

/** Secteurs les plus forts du mois (score moyen des signaux) pour les recommandations. */
async function getTopSectors(
  supabase: Supa,
  month: string,
  nextMonth: string,
): Promise<Array<{ sector: string; avgRsi: number; avgScore: number }>> {
  const { data, error } = await supabase
    .from('signals_daily')
    .select('score_total, inputs, brvm_instruments!inner(secteur)')
    .gte('date_marche', `${month}-01`)
    .lt('date_marche', `${nextMonth}-01`);
  if (error || !data) {
    logger.warn({ error }, 'Lecture secteurs échouée');
    return [];
  }
  const stats = new Map<string, { rsis: number[]; scores: number[] }>();
  for (const row of data as any[]) {
    // Le join to-one peut être typé objet ou tableau selon le client — accès souple.
    const rel = row.brvm_instruments;
    const sector: string = (Array.isArray(rel) ? rel[0]?.secteur : rel?.secteur) || 'Autre';
    const rsi = typeof row.inputs?.rsi === 'number' ? row.inputs.rsi : 50;
    const score = typeof row.score_total === 'number' ? row.score_total : 0;
    if (!stats.has(sector)) stats.set(sector, { rsis: [], scores: [] });
    const s = stats.get(sector)!;
    s.rsis.push(rsi);
    s.scores.push(score);
  }
  const results: Array<{ sector: string; avgRsi: number; avgScore: number }> = [];
  stats.forEach((s, sector) => {
    results.push({
      sector,
      avgRsi: s.rsis.reduce((a, b) => a + b, 0) / s.rsis.length,
      avgScore: s.scores.reduce((a, b) => a + b, 0) / s.scores.length,
    });
  });
  return results.sort((a, b) => b.avgScore - a.avgScore).slice(0, 3);
}

/** Mois précédent au format YYYY-MM. */
function previousMonth(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-based ; le mois précédent = m (car getMonth()+1 serait le courant)
  const date = new Date(Date.UTC(y, m - 1, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Mois suivant au format YYYY-MM (borne haute exclusive). */
function getNextMonth(month: string): string {
  const [y, m] = month.split('-').map((x) => parseInt(x, 10));
  let nm = (m ?? 1) + 1;
  let ny = y ?? 2026;
  if (nm > 12) { nm = 1; ny++; }
  return `${ny}-${String(nm).padStart(2, '0')}`;
}
