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
import { sma, ema, rsi } from './indicators.js';
import { buildMockSnapshot } from '../mock/fixtures.js';
import type { MarketDate } from '../types.js';

const HISTORY_DEPTH = 200; // augmenté pour SMA200

/** Indicateurs techniques persistables pour une série de clôtures. */
export interface IndicatorRow {
  instrument_code: string;
  date_marche: MarketDate;
  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
  ema_12: number | null;
  ema_26: number | null;
  rsi_14: number | null;
  macd_line: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  is_oversold: boolean | null;
  is_overbought: boolean | null;
  is_golden_cross: boolean | null;
  is_death_cross: boolean | null;
  is_breakout_20d_high: boolean | null;
  is_breakdown_20d_low: boolean | null;
  min_history_required: number;
  is_reliable: boolean;
}

export function computeIndicators(
  code: string,
  dateMarche: MarketDate,
  closes: number[],
): IndicatorRow {
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const rsi14 = rsi(closes, 14);
  const macdLine = ema12 != null && ema26 != null ? ema12 - ema26 : null;
  // MACD signal = EMA(9) de la ligne MACD — approximation : on n'a pas la série de MACD ici.
  const macdSignal = null;
  const macdHist = null;

  // Détection golden/death cross : compare aux SMA20/50 de la veille.
  const sma20Prev = closes.length >= 21 ? sma(closes.slice(0, -1), 20) : null;
  const sma50Prev = closes.length >= 51 ? sma(closes.slice(0, -1), 50) : null;
  const isGolden =
    sma20 != null && sma50 != null && sma20Prev != null && sma50Prev != null
      ? sma20 > sma50 && sma20Prev <= sma50Prev
      : null;
  const isDeath =
    sma20 != null && sma50 != null && sma20Prev != null && sma50Prev != null
      ? sma20 < sma50 && sma20Prev >= sma50Prev
      : null;

  // Breakout/breakdown 20j (close vs max/min des 20 séances précédentes, exclu).
  let breakoutHigh: boolean | null = null;
  let breakdownLow: boolean | null = null;
  if (closes.length >= 21) {
    const window = closes.slice(-21, -1);
    const last = closes[closes.length - 1]!;
    breakoutHigh = last > Math.max(...window);
    breakdownLow = last < Math.min(...window);
  }

  return {
    instrument_code: code,
    date_marche: dateMarche,
    sma_20: sma20,
    sma_50: sma50,
    sma_200: sma200,
    ema_12: ema12,
    ema_26: ema26,
    rsi_14: rsi14,
    macd_line: macdLine,
    macd_signal: macdSignal,
    macd_histogram: macdHist,
    is_oversold: rsi14 != null ? rsi14 < 30 : null,
    is_overbought: rsi14 != null ? rsi14 > 70 : null,
    is_golden_cross: isGolden,
    is_death_cross: isDeath,
    is_breakout_20d_high: breakoutHigh,
    is_breakdown_20d_low: breakdownLow,
    min_history_required: 200,
    is_reliable: closes.length >= 200,
  };
}

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
    const indicators: IndicatorRow[] = [];
    for (const row of inputsRows ?? []) {
      const code = row.code as string;
      const closes = await fetchCloses(sb, code, dateMarche);
      const input: ScoreInput = {
        code,
        closes,
        variation_pct: row.variation_pct as number | null,
        volume: row.volume as number | null,
        avg_volume_30d: row.avg_volume_30d as number | null,
      };
      results.push(computeScore(input));
      indicators.push(computeIndicators(code, dateMarche, closes));
    }

    await upsertSignals(sb, results, dateMarche);
    await upsertIndicators(sb, indicators);
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

async function upsertIndicators(
  sb: ReturnType<typeof getSupabase>,
  rows: IndicatorRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const cfg = getConfig();
  if (cfg.DRY_RUN) {
    logger.warn({ count: rows.length }, 'DRY_RUN — technical_indicators non écrit');
    return;
  }
  const { error } = await sb
    .from('technical_indicators')
    .upsert(rows, { onConflict: 'instrument_code,date_marche' });
  if (error) {
    // Non-bloquant : on log mais on ne fait pas échouer le run de signaux.
    logger.warn({ err: error.message }, 'upsert technical_indicators a échoué');
  }
}

function countBySignal(results: ScoreResult[]): Record<string, number> {
  return results.reduce<Record<string, number>>((acc, r) => {
    acc[r.signal] = (acc[r.signal] ?? 0) + 1;
    return acc;
  }, {});
}

/**
 * Démonstration mock : historique synthétique diversifié + persistance Supabase.
 * Génère des profils variés (BUY, SELL, HOLD) pour démontrer l'explicabilité.
 */
async function runScoringMock(): Promise<ScoringRunResult> {
  const cfg = getConfig();
  const snap = buildMockSnapshot();

  type Profile = 'bullish' | 'bearish' | 'neutral' | 'oversold' | 'overbought';
  // On assigne un profil par titre pour couvrir toute la gamme de signaux.
  const profiles: Profile[] = ['bullish', 'bearish', 'oversold', 'overbought', 'neutral', 'bullish', 'bearish', 'neutral'];

  const results = snap.actions.map((a, i) => {
    const closes = synthSeriesProfile(a.cours_jour ?? 1000, 80, profiles[i % profiles.length]!);
    // Volume ratio : profil bullish → volume > moyenne ; bearish → volume fort aussi.
    const volRatio = profiles[i % profiles.length] === 'neutral' ? 0.8 : 2.5;
    return computeScore({
      code: a.code,
      closes,
      variation_pct: a.variation_pct,
      volume: a.volume,
      avg_volume_30d: a.volume != null ? a.volume / volRatio : null,
    });
  });

  const repartition = countBySignal(results);
  logger.info({ repartition }, 'Scoring MOCK calculé');
  for (const r of results) {
    logger.info({ code: r.code, signal: r.signal, score: r.score_total, conf: r.confiance }, r.explication);
  }

  // Persiste dans Supabase comme le mode réel (sauf DRY_RUN).
  if (!cfg.DRY_RUN) {
    try {
      const sb = getSupabase();
      await upsertSignals(sb, results, snap.date_marche);
      logger.info({ count: results.length }, 'Signaux MOCK persistés dans signals_daily');
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'upsert mock signals a échoué — non bloquant');
    }
  }

  return {
    date_marche: snap.date_marche,
    nb_signaux: results.length,
    repartition,
    status: 'mock',
    message: null,
  };
}

/**
 * Série synthétique de clôtures selon un profil :
 *   bullish   : tendance haussière régulière → RSI élevé, MA20 > MA50 → BUY
 *   bearish   : tendance baissière régulière → RSI bas, MA20 < MA50 → SELL
 *   oversold  : chute longue puis rebond → RSI < 30 → BUY potentiel
 *   overbought: montée longue → RSI > 70 → SELL potentiel
 *   neutral   : marche aléatoire stable → HOLD
 */
function synthSeriesProfile(last: number, n: number, profile: 'bullish' | 'bearish' | 'neutral' | 'oversold' | 'overbought'): number[] {
  const out: number[] = [];
  let v: number;
  switch (profile) {
    case 'bullish':
      v = last * 0.80;
      for (let i = 0; i < n; i++) {
        v = v * (1 + 0.004 + (Math.random() - 0.3) * 0.008);
        out.push(Math.max(1, v));
      }
      break;
    case 'bearish':
      v = last * 1.20;
      for (let i = 0; i < n; i++) {
        v = v * (1 - 0.004 + (Math.random() - 0.7) * 0.008);
        out.push(Math.max(1, v));
      }
      break;
    case 'oversold':
      v = last * 1.30;
      for (let i = 0; i < n; i++) {
        // Forte baisse les 2/3 puis rebond final.
        const drift = i < (n * 2) / 3 ? -0.006 : 0.003;
        v = v * (1 + drift + (Math.random() - 0.5) * 0.006);
        out.push(Math.max(1, v));
      }
      break;
    case 'overbought':
      v = last * 0.70;
      for (let i = 0; i < n; i++) {
        // Forte hausse les 2/3 puis plateau.
        const drift = i < (n * 2) / 3 ? 0.007 : 0.001;
        v = v * (1 + drift + (Math.random() - 0.5) * 0.006);
        out.push(Math.max(1, v));
      }
      break;
    default: // neutral
      v = last * 0.95;
      for (let i = 0; i < n; i++) {
        v = v * (1 + (Math.sin(i / 3) * 0.005 + (Math.random() - 0.5) * 0.006));
        out.push(Math.max(1, v));
      }
  }
  out[out.length - 1] = last;
  return out;
}

/** Marche aléatoire bornée se terminant proche de `last` (utilisée par runBacktestCmd). */
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
