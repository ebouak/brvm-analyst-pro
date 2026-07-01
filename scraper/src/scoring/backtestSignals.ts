/**
 * Backtest rétroactif des signaux BUY : applique la méthode de scoring
 * ACTUELLE (computeScore, avec volume réel) à l'historique des cours pour
 * évaluer la performance de la méthode. Fonction pure, testable.
 *
 * Distinct de backtesting/runBacktest.ts (equity curve long-only PAR TITRE,
 * volume forcé à null — sert la page /backtest). Ici : recense chaque signal
 * BUY émis historiquement (tous titres confondus), déduplique les séquences
 * consécutives (un même titre qui reste BUY plusieurs jours ne compte qu'une
 * fois), et mesure la performance à horizon fixe (~30 jours calendaires ≈ 21
 * séances de bourse).
 */
import { computeScore } from './score.js';

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  close: number;
  volume: number | null;
}

export interface BacktestSignal {
  code: string;
  dateSignal: string;
  coursSignal: number;
  coursHorizon: number | null;
  perfPct: number | null;
  horizonSeances: number;
}

const HORIZON_SEANCES = 21; // ~30 jours calendaires en séances de bourse
const WARMUP = 50; // historique minimum avant de commencer à scorer (MA50 + RSI)
const MIN_GAP_DAYS = 5; // écart (jours) au-delà duquel on considère une nouvelle séquence BUY

/**
 * Calcule les signaux BUY rétrocalculés pour UN titre, dédupliqués (1er jour
 * de chaque séquence consécutive de BUY), avec performance à horizon fixe.
 */
export function backtestSignalsForCode(code: string, points: DailyPoint[]): BacktestSignal[] {
  if (points.length < WARMUP + 1) return [];

  const closes: number[] = [];
  const volumes: number[] = [];
  const raw: { date: string; close: number }[] = [];

  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    closes.push(p.close);
    if (p.volume != null) volumes.push(p.volume);
    if (i < WARMUP) continue;

    const prevClose = points[i - 1]!.close;
    const variation_pct = prevClose !== 0 ? ((p.close - prevClose) / prevClose) * 100 : null;
    const avgVolume30d = volumes.length > 0 ? volumes.slice(-30).reduce((a, b) => a + b, 0) / Math.min(30, volumes.length) : null;

    const res = computeScore({
      code,
      closes,
      variation_pct,
      volume: p.volume,
      avg_volume_30d: avgVolume30d,
    });

    if (res.signal === 'BUY') raw.push({ date: p.date, close: p.close });
  }

  // Déduplique : ne garde que le 1er jour de chaque séquence (écart > MIN_GAP_DAYS = nouvelle séquence).
  const deduped: { date: string; close: number; index: number }[] = [];
  let prevDate: Date | null = null;
  for (const r of raw) {
    const d = new Date(r.date + 'T00:00:00Z');
    if (!prevDate || (d.getTime() - prevDate.getTime()) / 86_400_000 > MIN_GAP_DAYS) {
      const index = points.findIndex((p) => p.date === r.date);
      deduped.push({ date: r.date, close: r.close, index });
    }
    prevDate = d;
  }

  return deduped.map(({ date, close, index }) => {
    const targetIndex = index + HORIZON_SEANCES;
    const target = targetIndex < points.length ? points[targetIndex] : null;
    const coursHorizon = target?.close ?? null;
    const perfPct = coursHorizon != null ? ((coursHorizon - close) / close) * 100 : null;
    return {
      code,
      dateSignal: date,
      coursSignal: close,
      coursHorizon,
      perfPct,
      horizonSeances: HORIZON_SEANCES,
    };
  });
}

export interface BacktestSummary {
  nTotal: number;
  nWithHorizon: number;
  avgPerfPct: number | null;
  pctPositive: number | null;
}

/** Agrège les statistiques d'un ensemble de signaux rétrocalculés. */
export function summarizeBacktest(signals: BacktestSignal[]): BacktestSummary {
  const withHorizon = signals.filter((s) => s.perfPct != null);
  const nTotal = signals.length;
  const nWithHorizon = withHorizon.length;
  if (nWithHorizon === 0) return { nTotal, nWithHorizon: 0, avgPerfPct: null, pctPositive: null };
  const avgPerfPct = withHorizon.reduce((a, s) => a + (s.perfPct as number), 0) / nWithHorizon;
  const pctPositive = (withHorizon.filter((s) => (s.perfPct as number) > 0).length / nWithHorizon) * 100;
  return { nTotal, nWithHorizon, avgPerfPct, pctPositive };
}
