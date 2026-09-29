import { clamp } from './math';
import { LIQUIDITY_WEIGHTS, LIQUIDITY_PENALTIES, LIQUIDITY_MIN_TRADING_DAYS_90 } from './constants';
import type { Penalty } from './types';

export interface LiquidityInputs {
  tradingDays90: number | null; // nb séances avec transaction sur 90j
  avgTradedValue90: number | null;
  totalVolume90: number | null;
  spreadBps?: number | null;
  peerTradingDays?: number[]; // pour percentile
  peerAvgValue?: number[];
  peerVolume?: number[];
}

function pctScore(value: number | null, peers: number[] | undefined, higherIsBetter = true): number | null {
  if (value == null || !Number.isFinite(value) || !peers || peers.length < 2) return null;
  const sorted = [...peers].sort((a, b) => a - b);
  let less = 0, eq = 0;
  const mapped = higherIsBetter ? sorted : sorted.map((v) => -v);
  const vMapped = higherIsBetter ? value : -value;
  const ms = [...mapped].sort((a, b) => a - b);
  for (const x of ms) { if (x < vMapped) less++; else if (x === vMapped) eq++; }
  return clamp(Math.round(((less + 0.5 * eq) / ms.length) * 100), 0, 100);
}

export function computeLiquidityScore(inp: LiquidityInputs): { liquidityScore: number | null; tradingDaysScore: number | null; avgValueScore: number | null; volumeScore: number | null; notes: string[] } {
  const notes: string[] = [];
  // Fallback si pas de peers : score heuristique simple
  let tScore: number | null = null, aScore: number | null = null, vScore: number | null = null;
  if (inp.peerTradingDays && inp.peerTradingDays.length >= 5) {
    tScore = pctScore(inp.tradingDays90, inp.peerTradingDays, true);
  } else if (inp.tradingDays90 != null) {
    tScore = clamp(Math.round((inp.tradingDays90 / 90) * 100), 0, 100);
    notes.push('TradingDaysScore heuristique (peers insuffisants)');
  }
  if (inp.peerAvgValue && inp.peerAvgValue.length >= 5) {
    aScore = pctScore(inp.avgTradedValue90, inp.peerAvgValue, true);
  } else if (inp.avgTradedValue90 != null) {
    // log-scale heuristic
    aScore = inp.avgTradedValue90 <= 0 ? 0 : clamp(Math.round(10 * Math.log10(inp.avgTradedValue90 / 1e5 + 1) * 20), 0, 100);
    if (inp.avgTradedValue90 != null) notes.push('AvgTradedValueScore heuristique');
  }
  if (inp.peerVolume && inp.peerVolume.length >= 5) {
    vScore = pctScore(inp.totalVolume90, inp.peerVolume, true);
  } else if (inp.totalVolume90 != null) {
    vScore = inp.totalVolume90 <= 0 ? 0 : clamp(Math.round(10 * Math.log10(inp.totalVolume90 / 1e4 + 1) * 15), 0, 100);
    if (inp.totalVolume90 != null) notes.push('VolumeScore heuristique');
  }
  const parts: { s: number | null; w: number }[] = [
    { s: tScore, w: LIQUIDITY_WEIGHTS.tradingDays },
    { s: aScore, w: LIQUIDITY_WEIGHTS.avgTradedValue },
    { s: vScore, w: LIQUIDITY_WEIGHTS.volume },
  ];
  const avail = parts.filter((p) => p.s != null) as { s: number; w: number }[];
  if (avail.length === 0) return { liquidityScore: null, tradingDaysScore: tScore, avgValueScore: aScore, volumeScore: vScore, notes };
  const wSum = avail.reduce((a, p) => a + p.w, 0);
  const score = Math.round(avail.reduce((a, p) => a + p.s * (p.w / wSum), 0));
  return { liquidityScore: score, tradingDaysScore: tScore, avgValueScore: aScore, volumeScore: vScore, notes };
}

export function liquidityPenalty(liquidityScore: number | null): { penalty: number; penaltyLabel: string } {
  if (liquidityScore == null) return { penalty: 15, penaltyLabel: 'Liquidité inconnue' };
  for (const b of LIQUIDITY_PENALTIES) if (liquidityScore >= b.min) return { penalty: b.penalty, penaltyLabel: `LiquidityScore ${liquidityScore}` };
  return { penalty: 30, penaltyLabel: 'Liquidité très faible' };
}

export function liquidityEligibility(tradingDays90: number | null, liquidityScore: number | null): { eligible: boolean; warning: boolean; reason?: string } {
  if (tradingDays90 != null && tradingDays90 < LIQUIDITY_MIN_TRADING_DAYS_90) {
    return { eligible: false, warning: false, reason: `<20 jours cotés/90j (${tradingDays90})` };
  }
  if (liquidityScore != null && liquidityScore < 30) return { eligible: true, warning: true, reason: 'Liquidité <30' };
  return { eligible: true, warning: false };
}

export function buildLiquidityPenalties(liquidityScore: number | null): Penalty[] {
  const { penalty } = liquidityPenalty(liquidityScore);
  if (penalty === 0) return [];
  return [{ code: 'LIQ', label: 'Pénalité liquidité', points: penalty, reason: `LiquidityScore ${liquidityScore ?? 'N/A'} → -${penalty}` }];
}
