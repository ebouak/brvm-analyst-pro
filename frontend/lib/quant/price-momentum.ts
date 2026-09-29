import { clamp, isFiniteNumber, dailyReturnsFromCloses, annualizedVolatility } from './math';
import { PM_WEIGHTS } from './constants';
import type { Penalty } from './types';
import { liquidityPenalty, liquidityEligibility } from './liquidity';

export interface PMFactors {
  m12_1: number | null;
  m6m: number | null;
  m3m: number | null;
  high52wProximity: number | null;
  trendConfirmation: number | null;
  liquidityScore: number | null;
  annualizedVol?: number | null;
}

export function computeMomentumFactors(closesAsc: number[]): Omit<PMFactors, 'liquidityScore' | 'annualizedVol'> {
  const n = closesAsc.length;
  const last = n > 0 ? closesAsc[n - 1] : null;
  const ret = (fromIdx: number, toIdx: number): number | null => {
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= n || toIdx >= n) return null;
    const a = closesAsc[fromIdx], b = closesAsc[toIdx];
    if (!isFiniteNumber(a) || !isFiniteNumber(b) || a <= 0) return null;
    return b / a - 1;
  };
  const m12_1 = ret(n - 252, n - 21);
  const m6m = ret(n - 126, n - 1);
  const m3m = ret(n - 63, n - 1);
  let high52w: number | null = null;
  if (last != null && n >= 2) {
    const win = closesAsc.slice(Math.max(0, n - 252));
    const mx = Math.max(...win.filter(isFiniteNumber));
    if (isFiniteNumber(mx) && mx > 0) high52w = last / mx;
  }
  const ma = (period: number): number | null => {
    if (n < period) return null;
    const w = closesAsc.slice(n - period);
    if (w.some((v) => !isFiniteNumber(v))) return null;
    return w.reduce((a, b) => a + b, 0) / period;
  };
  const ma100 = ma(100), ma200 = ma(200);
  let trend: number | null = null;
  if (ma100 != null && ma200 != null && last != null) {
    let s = 0;
    if (last > ma100) s += 40;
    if (last > ma200) s += 40;
    if (ma100 > ma200) s += 20;
    trend = s;
  } else if (last != null) {
    const ma6m = ma(126), ma12m = ma(252);
    if (ma6m != null && ma12m != null) {
      let s = 0;
      if (last > ma6m) s += 40;
      if (last > ma12m) s += 40;
      if (ma6m > ma12m) s += 20;
      trend = s;
    }
  }
  return { m12_1, m6m, m3m, high52wProximity: high52w, trendConfirmation: trend };
}

function toScore01(raw: number | null, lo = -0.3, hi = 0.6): number | null {
  if (raw == null || !isFiniteNumber(raw)) return null;
  const t = clamp((raw - lo) / (hi - lo), 0, 1);
  return Math.round(t * 100);
}

export function scorePriceMomentum(
  factors: PMFactors,
  options?: { volPeers?: number[] },
): { score: number | null; penalties: Penalty[]; breakdown: Record<string, number | null>; notes: string[] } {
  const notes: string[] = [];
  const penalties: Penalty[] = [];
  const s12 = toScore01(factors.m12_1, -0.4, 0.8);
  const s6 = toScore01(factors.m6m, -0.3, 0.5);
  const s3 = toScore01(factors.m3m, -0.2, 0.35);
  const sHigh = factors.high52wProximity == null ? null : clamp(Math.round(factors.high52wProximity * 100), 0, 100);
  const sTrend = factors.trendConfirmation;
  const parts: { v: number | null; w: number }[] = [
    { v: s12, w: PM_WEIGHTS.m12_1 },
    { v: s6, w: PM_WEIGHTS.m6m },
    { v: s3, w: PM_WEIGHTS.m3m },
    { v: sHigh, w: PM_WEIGHTS.high52w },
    { v: sTrend, w: PM_WEIGHTS.trend },
  ];
  const avail = parts.filter((p): p is { v: number; w: number } => p.v != null);
  if (avail.length < 3) {
    notes.push('Données insuffisantes (<3 facteurs momentum)');
    return { score: null, penalties, breakdown: { s12, s6, s3, sHigh, sTrend }, notes };
  }
  const wSum = avail.reduce((a, p) => a + p.w, 0);
  const rawScore = avail.reduce((a, p) => a + p.v * (p.w / wSum), 0);
  if (avail.length < 5) notes.push(`Score sur ${avail.length}/5 facteurs (poids redistribués)`);
  const { penalty: liqPen } = liquidityPenalty(factors.liquidityScore);
  if (liqPen > 0) penalties.push({ code: 'LIQ', label: 'Liquidité', points: liqPen, reason: `LiquidityScore ${factors.liquidityScore ?? 'N/A'} → -${liqPen}` });
  let volPen = 0;
  if (factors.annualizedVol != null && options?.volPeers && options.volPeers.length >= 10) {
    const sorted = [...options.volPeers].sort((a, b) => a - b);
    const rank = sorted.filter((v) => v <= factors.annualizedVol!).length / sorted.length;
    if (rank >= 0.95) volPen = 10;
    else if (rank >= 0.90) volPen = 5;
    if (volPen > 0) penalties.push({ code: 'VOL', label: 'Volatilité extrême', points: volPen, reason: `Vol ${factors.annualizedVol!.toFixed(2)} rang ${(rank * 100).toFixed(0)}% → -${volPen}` });
  }
  let finalScore = clamp(Math.round(rawScore - liqPen - volPen), 0, 100);
  return { score: finalScore, penalties, breakdown: { s12, s6, s3, sHigh, sTrend }, notes };
}

export function buildEligibilityForMomentum(closesAsc: number[], tradingDays90: number | null, liquidityScore: number | null): { status: 'eligible' | 'eligible_with_warning' | 'ineligible'; notes: string[] } {
  if (closesAsc.length < 60) return { status: 'ineligible', notes: ['<60 cours'] };
  const elig = liquidityEligibility(tradingDays90, liquidityScore);
  if (!elig.eligible) return { status: 'ineligible', notes: [elig.reason ?? 'Illiquidité'] };
  if (elig.warning) return { status: 'eligible_with_warning', notes: [elig.reason ?? 'Liquidité faible'] };
  return { status: 'eligible', notes: [] };
}

export function computeAnnualizedVol(closesAsc: number[]): number | null {
  const rets = dailyReturnsFromCloses(closesAsc.slice(-260));
  return annualizedVolatility(rets);
}
