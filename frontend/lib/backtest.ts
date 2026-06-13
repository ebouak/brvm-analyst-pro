import type { SignalLabel } from './types';

export interface BacktestInput {
  closes: number[];
  signals: SignalLabel[];
  dates?: string[];      // optional ISO dates for each close point
  feesPct?: number;      // default 0 (e.g. 0.006 = 0.6%)
  slippagePct?: number;  // default 0
  riskFreeRate?: number; // taux sans risque annuel (défaut 0.06 UEMOA)
}

/** Un aller-retour (entrée BUY → sortie SELL ou clôture au dernier cours). */
export interface Trade {
  entryIndex: number;
  exitIndex: number | null;   // null = position encore ouverte en fin de période
  entryDate?: string;
  exitDate?: string;
  entryPrice: number;         // net frais/slippage d'entrée
  exitPrice: number | null;   // net frais/slippage de sortie
  returnPct: number | null;   // rendement net du trade
  bars: number | null;        // durée en séances
  win: boolean | null;
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
  sortinoRatio: number | null;
  calmarRatio: number | null;
  drawdownPeriods: { start: number; end: number }[];
  trades: Trade[];
  avgWinPct: number | null;
  avgLossPct: number | null;
  bestTradePct: number | null;
  worstTradePct: number | null;
  riskFreeRate: number;
}

const EMPTY_RESULT = (n: number, riskFreeRate: number): BacktestResult => ({
  equityCurve: Array.from({ length: n }, (_, i) => ({ date_index: i, value: 100 })),
  totalReturn: 0,
  annualizedReturn: 0,
  volatility: 0,
  maxDrawdown: 0,
  winRate: 0,
  numTrades: 0,
  buyAndHoldReturn: 0,
  sharpeRatio: null,
  sortinoRatio: null,
  calmarRatio: null,
  drawdownPeriods: [],
  trades: [],
  avgWinPct: null,
  avgLossPct: null,
  bestTradePct: null,
  worstTradePct: null,
  riskFreeRate,
});

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function runBacktest(input: BacktestInput): BacktestResult {
  const { closes, signals, dates, feesPct = 0, slippagePct = 0, riskFreeRate = 0.06 } = input;

  if (closes.length !== signals.length) {
    throw new Error(
      `closes and signals must have the same length (got ${closes.length} vs ${signals.length})`
    );
  }

  const n = closes.length;

  if (n < 2) {
    return EMPTY_RESULT(n, riskFreeRate);
  }

  const equityCurve: { date_index: number; date?: string; value: number }[] = [];
  const dailyReturns: number[] = [];

  let equity = 100;
  let inPosition = false;
  let entryPrice = 0;
  let entryIndex = 0;

  let numTrades = 0;
  let winningTrades = 0;
  let closedTrades = 0;

  let peakEquity = 100;
  let maxDrawdown = 0;

  const trades: Trade[] = [];

  for (let i = 0; i < n; i++) {
    const signal = signals[i];
    const price = closes[i];

    if (!inPosition && signal === 'BUY') {
      inPosition = true;
      // Apply fees + slippage on entry
      entryPrice = price * (1 + feesPct + slippagePct);
      entryIndex = i;
      numTrades++;
    } else if (inPosition && signal === 'SELL') {
      // Apply fees + slippage on exit
      const effectiveSellPrice = price * (1 - feesPct - slippagePct);
      const win = effectiveSellPrice > entryPrice;
      if (win) winningTrades++;
      closedTrades++;
      inPosition = false;
      const tr: Trade = {
        entryIndex,
        exitIndex: i,
        entryPrice,
        exitPrice: effectiveSellPrice,
        returnPct: effectiveSellPrice / entryPrice - 1,
        bars: i - entryIndex,
        win,
      };
      if (dates) { if (dates[entryIndex] !== undefined) tr.entryDate = dates[entryIndex]; if (dates[i] !== undefined) tr.exitDate = dates[i]; }
      trades.push(tr);
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

  // Position encore ouverte en fin de période : trade latent clôturé au dernier cours.
  if (inPosition) {
    const lastPrice = closes[n - 1]! * (1 - feesPct - slippagePct);
    const tr: Trade = {
      entryIndex,
      exitIndex: null,
      entryPrice,
      exitPrice: lastPrice,
      returnPct: lastPrice / entryPrice - 1,
      bars: n - 1 - entryIndex,
      win: lastPrice > entryPrice,
    };
    if (dates) { if (dates[entryIndex] !== undefined) tr.entryDate = dates[entryIndex]; }
    trades.push(tr);
  }

  const finalEquity = equity;
  const totalReturn = finalEquity / 100 - 1;
  const annualizedReturn = Math.pow(finalEquity / 100, 252 / n) - 1;

  const vol = stddev(dailyReturns) * Math.sqrt(252);

  const winRate = closedTrades > 0 ? winningTrades / closedTrades : 0;

  const buyAndHoldReturn = (closes[n - 1]! - closes[0]!) / closes[0]!;

  // Sharpe / Sortino en EXCÈS sur le taux sans risque (best practice analyste).
  const rfDaily = Math.pow(1 + riskFreeRate, 1 / 252) - 1;
  const excessAnnual = annualizedReturn - riskFreeRate;
  const sharpeRatio = vol === 0 ? null : excessAnnual / vol;

  // Downside deviation : écart-type des rendements sous le seuil sans risque.
  const downside = dailyReturns.map((r) => Math.min(0, r - rfDaily));
  const downsideVar = downside.reduce((s, v) => s + v * v, 0) / downside.length;
  const downsideDev = Math.sqrt(downsideVar) * Math.sqrt(252);
  const sortinoRatio = downsideDev === 0 ? null : excessAnnual / downsideDev;

  const calmarRatio = maxDrawdown === 0 ? null : annualizedReturn / maxDrawdown;

  // Statistiques d'exécution (sur trades avec rendement connu).
  const rets = trades.map((t) => t.returnPct).filter((r): r is number => r != null);
  const wins = rets.filter((r) => r > 0);
  const losses = rets.filter((r) => r <= 0);
  const avg = (arr: number[]): number | null => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

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
    sortinoRatio,
    calmarRatio,
    drawdownPeriods,
    trades,
    avgWinPct: avg(wins),
    avgLossPct: avg(losses),
    bestTradePct: rets.length ? Math.max(...rets) : null,
    worstTradePct: rets.length ? Math.min(...rets) : null,
    riskFreeRate,
  };
}
