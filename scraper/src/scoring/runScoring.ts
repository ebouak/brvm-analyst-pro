/**
 * Runner de génération des signaux (cf. §5.4 / §6.7).
 *
 * Pour la dernière séance disponible :
 *   1. liste les codes actions cotés ce jour-là ;
 *   2. récupère l'historique de clôture (jusqu'à ~120 séances) par titre ;
 *   3. calcule le score + signal (computeScore) ;
 *   4. upsert dans signals_daily (idempotent par (code, date_marche)).
 *
 * En mode mock, on génère un historique synthétique pour démontrer le pipeline
 * sans dépendre de Supabase.
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { computeScore, type ScoreInput, type ScoreResult } from './score.js';
import { buildMockSnapshot } from '../mock/fixtures.js';
import type { MarketDate } from '../types.js';

const HISTORY_DEPTH = 120;

export interface ScoringRunOptions {
  date?: MarketDate;
  mock?: boolean;
}

export interface ScoringRunResult {
  date_marche: MarketDate | null;
  nb_signaux: number;
  repartition: Record<string, number>;
  status: 'success' | 'failed' | 'mock';
  message: string | null;
}

export async function runScoring(
  opts: ScoringRunOptions = {},
): Promise<ScoringRunResult> {
  const cfg = getConfig();
  const useMock = opts.mock || cfg.USE_MOCK;

  try {
    if (useMock) {
      return await runScoringMock();
    }

    const sb = getSupabase();

    // 1) Déterminer la date cible.
    let dateMarche = opts.date ?? null;
    if (!dateMarche) {
      const { data, error } = await sb
        .from('brvm_actions_daily')
        .select('date_marche')
        .order('date_marche', { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      dateMarche = data?.[0]?.date_marche ?? null;
    }
    if (!dateMarche) {
      return {
        date_marche: null,
        nb_signaux: 0,
        repartition: {},
        status: 'success',
        message: 'Aucune donnée actions disponible',
      };
    }

    // 2) Entrées de scoring de la séance (volume moyen via mv_signal_inputs).
    const { data: inputsRows, error: e2 } = await sb
      .from('mv_signal_inputs')
      .select('code, variation_pct, volume, avg_volume_30d');
    if (e2) throw new Error(`mv_signal_inputs: ${e2.message}`);

    const results: ScoreResult[] = [];
    for (const row of inputsRows ?? []) {
      const closes = await fetchCloses(sb, row.code as string, dateMarche);
      const input: ScoreInput = {
        code: row.code as string,
        closes,
        variation_pct: row.variation_pct as number | null,
        volume: row.volume as number | null,
        avg_volume_30d: row.avg_volume_30d as number | null,
      };
      results.push(computeScore(input));
    }

    await upsertSignals(sb, results, dateMarche);
    const repartition = countBySignal(results);
    logger.info({ date: dateMarche, repartition }, 'Signaux générés');

    return {
      date_marche: dateMarche,
      nb_signaux: results.length,
      repartition,
      status: 'success',
      message: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Scoring en échec');
    return {
      date_marche: opts.date ?? null,
      nb_signaux: 0,
      repartition: {},
      status: 'failed',
      message,
    };
  }
}

/** Récupère les clôtures (ancien -> récent) jusqu'à la date donnée. */
async function fetchCloses(
  sb: ReturnType<typeof getSupabase>,
  code: string,
  dateMarche: MarketDate,
): Promise<number[]> {
  const { data, error } = await sb
    .from('brvm_actions_daily')
    .select('cours_jour, date_marche')
    .eq('code', code)
    .lte('date_marche', dateMarche)
    .order('date_marche', { ascending: false })
    .limit(HISTORY_DEPTH);
  if (error) {
    logger.warn({ code, err: error.message }, 'Historique indisponible');
    return [];
  }
  // On a récupéré du plus récent au plus ancien -> inverser, filtrer les null.
  return (data ?? [])
    .map((r) => r.cours_jour as number | null)
    .filter((v): v is number => v != null)
    .reverse();
}

async function upsertSignals(
  sb: ReturnType<typeof getSupabase>,
  results: ScoreResult[],
  dateMarche: MarketDate,
): Promise<void> {
  if (results.length === 0) return;
  const cfg = getConfig();
  const rows = results.map((r) => ({
    code: r.code,
    date_marche: dateMarche,
    signal: r.signal,
    score_total: r.score_total,
    score_variation: r.score_variation,
    score_volume: r.score_volume,
    score_rsi: r.score_rsi,
    bonus_tendance: r.bonus_tendance,
    penalite_liquidite: r.penalite_liquidite,
    confiance: r.confiance,
    explication: r.explication,
    inputs: r.inputs,
  }));
  if (cfg.DRY_RUN) {
    logger.warn({ count: rows.length }, 'DRY_RUN — signals_daily non écrit');
    return;
  }
  const { error } = await sb
    .from('signals_daily')
    .upsert(rows, { onConflict: 'code,date_marche' });
  if (error) throw new Error(`upsert signals_daily: ${error.message}`);
}

function countBySignal(results: ScoreResult[]): Record<string, number> {
  return results.reduce<Record<string, number>>((acc, r) => {
    acc[r.signal] = (acc[r.signal] ?? 0) + 1;
    return acc;
  }, {});
}

/** Démonstration hors-ligne : historique synthétique + scoring affiché. */
async function runScoringMock(): Promise<ScoringRunResult> {
  const snap = buildMockSnapshot();
  const results = snap.actions.map((a) => {
    // Génère une série de clôtures plausible se terminant au cours du jour.
    const closes = synthSeries(a.cours_jour ?? 1000, 60);
    return computeScore({
      code: a.code,
      closes,
      variation_pct: a.variation_pct,
      volume: a.volume,
      avg_volume_30d: a.volume != null ? a.volume * 0.9 : null,
    });
  });
  const repartition = countBySignal(results);
  logger.info({ repartition }, 'Scoring MOCK calculé');
  for (const r of results) {
    logger.info(
      { code: r.code, signal: r.signal, score: r.score_total, conf: r.confiance },
      r.explication,
    );
  }
  return {
    date_marche: snap.date_marche,
    nb_signaux: results.length,
    repartition,
    status: 'mock',
    message: null,
  };
}

/** Marche aléatoire bornée se terminant proche de `last`. */
function synthSeries(last: number, n: number): number[] {
  const out: number[] = [];
  let v = last * 0.95;
  for (let i = 0; i < n; i++) {
    v = v * (1 + (Math.sin(i / 3) * 0.01 + (Math.random() - 0.5) * 0.01));
    out.push(Math.max(1, v));
  }
  out[out.length - 1] = last;
  return out;
}
