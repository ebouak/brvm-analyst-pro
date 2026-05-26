import type { SignalLabel } from './types.js';

export interface BacktestInput {
  closes: number[];
  signals: SignalLabel[];
  dates?: string[];      // optional ISO dates for each close point
  feesPct?: number;      // default 0 (e.g. 0.006 = 0.6%)
  slippagePct?: number;  // default 0
}

export interface BacktestResult {
  equityCurve: { date_index: number; date?: string; value: number }[];
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  maxDrawdown: number;
  winRate: number;
  numTrades: number;
  buyAndHoldReturn: number;
  sharpeRatio: number | null;
  drawdownPeriods: { start: number; end: number }[];
}

const EMPTY_RESULT = (n: number): BacktestResult => ({
  equityCurve: Array.from({ length: n }, (_, i) => ({ date_index: i, value: 100 })),
  totalReturn: 0,
  annualizedReturn: 0,
  volatility: 0,
  maxDrawdown: 0,
  winRate: 0,
  numTrades: 0,
  buyAndHoldReturn: 0,
  sharpeRatio: null,
  drawdownPeriods: [],
});

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function runBacktest(input: BacktestInput): BacktestResult {
  const { closes, signals, dates, feesPct = 0, slippagePct = 0 } = input;

  if (closes.length !== signals.length) {
    throw new Error(
      `closes and signals must have the same length (got ${closes.length} vs ${signals.length})`
    );
  }

  const n = closes.length;

  if (n < 2) {
    return EMPTY_RESULT(n);
  }

  const equityCurve: { date_index: number; date?: string; value: number }[] = [];
  const dailyReturns: number[] = [];

  let equity = 100;
  let inPosition = false;
  let entryPrice = 0;

  let numTrades = 0;
  let winningTrades = 0;
  let closedTrades = 0;

  let peakEquity = 100;
  let maxDrawdown = 0;

  for (let i = 0; i < n; i++) {
    const signal = signals[i];
    const price = closes[i];

    if (!inPosition && signal === 'BUY') {
      inPosition = true;
      // Apply fees + slippage on entry
      entryPrice = price * (1 + feesPct + slippagePct);
      numTrades++;
    } else if (inPosition && signal === 'SELL') {
      // Apply fees + slippage on exit
      const effectiveSellPrice = price * (1 - feesPct - slippagePct);
      if (effectiveSellPrice > entryPrice) winningTrades++;
      closedTrades++;
      inPosition = false;
    }

    let dayReturn = 0;
    if (inPosition && i > 0) {
      dayReturn = (closes[i] - closes[i - 1]) / closes[i - 1];
    }

    dailyReturns.push(dayReturn);
    equity = equity * (1 + dayReturn);

    const pt: { date_index: number; date?: string; value: number } = {
      date_index: i,
      value: equity,
    };
    if (dates && dates[i] !== undefined) {
      pt.date = dates[i];
    }
    equityCurve.push(pt);

    if (equity > peakEquity) peakEquity = equity;
    const drawdown = (peakEquity - equity) / peakEquity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Compute drawdown periods
  const drawdownPeriods: { start: number; end: number }[] = [];
  let peak = equityCurve[0]?.value ?? 100;
  let inDrawdown = false;
  let ddStart = 0;

  for (let i = 0; i < equityCurve.length; i++) {
    const val = equityCurve[i]!.value;
    if (val > peak) {
      if (inDrawdown) {
        drawdownPeriods.push({ start: ddStart, end: i - 1 });
        inDrawdown = false;
      }
      peak = val;
    } else if (val < peak && !inDrawdown) {
      inDrawdown = true;
      ddStart = i;
    }
  }
  if (inDrawdown) {
    drawdownPeriods.push({ start: ddStart, end: equityCurve.length - 1 });
  }

  const finalEquity = equity;
  const totalReturn = finalEquity / 100 - 1;
  const annualizedReturn = Math.pow(finalEquity / 100, 252 / n) - 1;

  const vol = stddev(dailyReturns) * Math.sqrt(252);

  const winRate = closedTrades > 0 ? winningTrades / closedTrades : 0;

  const buyAndHoldReturn = (closes[n - 1]! - closes[0]!) / closes[0]!;

  const sharpeRatio = vol === 0 ? null : annualizedReturn / vol;

  return {
    equityCurve,
    totalReturn,
    annualizedReturn,
    volatility: vol,
    maxDrawdown,
    winRate,
    numTrades,
    buyAndHoldReturn,
    sharpeRatio,
    drawdownPeriods,
  };
}
