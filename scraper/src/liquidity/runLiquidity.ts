/**
 * Calcule la liquidité v2 de tous les titres pour la dernière séance et
 * upsert liquidity_daily (clé code,date_marche — idempotent).
 * --mock : fixture en mémoire, aucun accès réseau ni écriture.
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { computeLiquidityV2, ENGINE_VERSION } from './compute.js';
import { computeSessionFlow, type FlowSnapshot } from './flow.js';

/** Fenêtre d'observation du score (séances de marché). */
const NB_SEANCES = 30;

export interface LiquidityRunResult {
  status: 'success' | 'mock' | 'failed';
  date_marche: string | null;
  nb_titres: number;
  nb_scores: number;
  nb_flux: number;
}

interface DailyRow {
  code: string; date_marche: string; cours_jour: number | null;
  variation_pct: number | null; volume: number | null; valeur_echangee: number | null;
}

function mockRows(): DailyRow[] {
  const out: DailyRow[] = [];
  for (let i = 0; i < 30; i++) {
    const d = `2026-06-${String(i + 1).padStart(2, '0')}`;
    out.push({ code: 'SNTS', date_marche: d, cours_jour: 17500, variation_pct: 0.3, volume: 5000, valeur_echangee: 87_500_000 });
    if (i % 5 === 0) out.push({ code: 'XXXC', date_marche: d, cours_jour: 900, variation_pct: 4, volume: 50, valeur_echangee: 45_000 });
  }
  return out;
}

export async function runLiquidity(opts: { mock?: boolean } = {}): Promise<LiquidityRunResult> {
  if (opts.mock) {
    const rows = mockRows();
    const dates = [...new Set(rows.map((r) => r.date_marche))].sort();
    const byCode = new Map<string, DailyRow[]>();
    for (const r of rows) {
      if (!byCode.has(r.code)) byCode.set(r.code, []);
      byCode.get(r.code)!.push(r);
    }
    let nbScores = 0;
    for (const [code, list] of byCode) {
      const res = computeLiquidityV2(list, dates.length);
      if (res.score != null) nbScores++;
      logger.info({ code, score: res.score, classe: res.classe }, '[mock] liquidité');
    }
    return { status: 'mock', date_marche: dates.at(-1) ?? null, nb_titres: byCode.size, nb_scores: nbScores, nb_flux: 0 };
  }

  const sb = getSupabase();

  // PostgREST plafonne CHAQUE réponse à 1000 lignes, quel que soit le .limit()
  // demandé. Avec 47 titres, une requête simple ne couvrait que 22 séances et
  // tronquait silencieusement les données (~1410 lignes attendues sur 30 séances).
  // On pagine donc explicitement par .range().
  const PAGE = 1000;

  // 1) Les 30 dernières séances de marché (pagination jusqu'à en avoir 30).
  const dateSet = new Set<string>();
  for (let offset = 0; dateSet.size < NB_SEANCES; offset += PAGE) {
    const { data, error } = await sb
      .from('brvm_actions_daily')
      .select('date_marche')
      .order('date_marche', { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as { date_marche: string }[];
    for (const r of rows) dateSet.add(r.date_marche);
    if (rows.length < PAGE) break;
  }
  const dates = [...dateSet].sort((a, b) => b.localeCompare(a)).slice(0, NB_SEANCES);
  if (dates.length === 0) {
    logger.warn('liquidité : aucune séance en base');
    return { status: 'failed', date_marche: null, nb_titres: 0, nb_scores: 0, nb_flux: 0 };
  }
  const lastDate = dates[0]!;

  // 2) Les cours de ces séances (paginés : ~1410 lignes > plafond).
  const daily: DailyRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb
      .from('brvm_actions_daily')
      .select('code, date_marche, cours_jour, variation_pct, volume, valeur_echangee')
      .in('date_marche', dates)
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as DailyRow[];
    daily.push(...rows);
    if (rows.length < PAGE) break;
  }

  // 3) Snapshots intraday de la dernière séance (paginés aussi : ~30 captures × 47 titres).
  const snaps: ({ code: string } & FlowSnapshot)[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb
      .from('brvm_intraday_snapshots')
      .select('code, captured_at, close, volume')
      .eq('date_marche', lastDate)
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as ({ code: string } & FlowSnapshot)[];
    snaps.push(...rows);
    if (rows.length < PAGE) break;
  }

  // 4) Référentiel des actions actives : un titre qui n'a JAMAIS traité sur la
  // fenêtre n'a aucune ligne dans brvm_actions_daily. Sans ce seed il serait
  // absent du classement, alors que c'est le cas le plus illiquide qui soit
  // (spec §3 : « titre jamais traité → classe D naturelle »).
  const { data: instruments, error: e4 } = await sb
    .from('brvm_instruments')
    .select('code')
    .eq('type', 'action')
    .eq('actif', true);
  if (e4) throw e4;

  const byCode = new Map<string, DailyRow[]>();
  for (const i of (instruments ?? []) as { code: string }[]) byCode.set(i.code, []);
  for (const r of daily) {
    if (!byCode.has(r.code)) byCode.set(r.code, []);
    byCode.get(r.code)!.push(r);
  }
  const snapsByCode = new Map<string, FlowSnapshot[]>();
  for (const s of snaps) {
    if (!snapsByCode.has(s.code)) snapsByCode.set(s.code, []);
    snapsByCode.get(s.code)!.push(s);
  }

  const records = [];
  let nbScores = 0;
  let nbFlux = 0;
  for (const [code, list] of byCode) {
    const liq = computeLiquidityV2(list, dates.length);
    const flow = computeSessionFlow(snapsByCode.get(code) ?? []);
    if (liq.score != null) nbScores++;
    if (flow?.flux_net_pct != null) nbFlux++;
    records.push({
      code,
      date_marche: lastDate,
      score: liq.score,
      classe: liq.classe,
      presence_pct: liq.presence_pct,
      activite: liq.activite,
      amihud: liq.amihud,
      spread_roll_pct: liq.spread_roll_pct,
      valeur_moyenne_30j: liq.valeur_moyenne_30j,
      seances_traitees: liq.seances_traitees,
      seances_marche: liq.seances_marche,
      volume_achat: flow?.volume_achat ?? null,
      volume_vente: flow?.volume_vente ?? null,
      volume_neutre: flow?.volume_neutre ?? null,
      flux_net_pct: flow?.flux_net_pct ?? null,
      engine_version: ENGINE_VERSION,
      updated_at: new Date().toISOString(),
    });
  }

  const cfg = getConfig();
  if (cfg.DRY_RUN) {
    logger.info({ nb: records.length }, '[DRY_RUN] upsert liquidity_daily sauté');
  } else {
    const { error: e4 } = await sb.from('liquidity_daily').upsert(records, { onConflict: 'code,date_marche' });
    if (e4) throw e4;
  }

  logger.info({ date: lastDate, titres: byCode.size, scores: nbScores, flux: nbFlux }, 'liquidité v2 calculée');
  return { status: 'success', date_marche: lastDate, nb_titres: byCode.size, nb_scores: nbScores, nb_flux: nbFlux };
}
