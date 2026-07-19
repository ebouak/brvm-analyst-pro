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

  const { data: dateRows, error: e1 } = await sb
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(4000);
  if (e1) throw e1;
  const dates = [...new Set((dateRows ?? []).map((r) => r.date_marche as string))].slice(0, 30);
  if (dates.length === 0) {
    logger.warn('liquidité : aucune séance en base');
    return { status: 'failed', date_marche: null, nb_titres: 0, nb_scores: 0, nb_flux: 0 };
  }
  const lastDate = dates[0]!;

  const { data: daily, error: e2 } = await sb
    .from('brvm_actions_daily')
    .select('code, date_marche, cours_jour, variation_pct, volume, valeur_echangee')
    .in('date_marche', dates);
  if (e2) throw e2;

  const { data: snaps, error: e3 } = await sb
    .from('brvm_intraday_snapshots')
    .select('code, captured_at, close, volume')
    .eq('date_marche', lastDate);
  if (e3) throw e3;

  const byCode = new Map<string, DailyRow[]>();
  for (const r of (daily ?? []) as DailyRow[]) {
    if (!byCode.has(r.code)) byCode.set(r.code, []);
    byCode.get(r.code)!.push(r);
  }
  const snapsByCode = new Map<string, FlowSnapshot[]>();
  for (const s of (snaps ?? []) as ({ code: string } & FlowSnapshot)[]) {
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
