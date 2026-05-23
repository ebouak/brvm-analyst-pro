import { computeScore } from '../scoring/score.js';
import type { SignalLabel } from '../scoring/score.js';
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';

// ----- Inline backtest engine (mirrors frontend/lib/backtest.ts) -----

export interface BacktestResult {
  equityCurve: { date_index: number; value: number }[];
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  maxDrawdown: number;
  winRate: number;
  numTrades: number;
  buyAndHoldReturn: number;
  sharpeRatio: number | null;
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
});

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function computeBacktest(closes: number[], signals: SignalLabel[]): BacktestResult {
  const n = closes.length;
  if (n < 2) return EMPTY_RESULT(n);

  const equityCurve: { date_index: number; value: number }[] = [];
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
    const signal = signals[i] ?? 'HOLD';
    const price = closes[i] ?? 0;

    if (!inPosition && signal === 'BUY') {
      inPosition = true;
      entryPrice = price;
      numTrades++;
    } else if (inPosition && signal === 'SELL') {
      if (price > entryPrice) winningTrades++;
      closedTrades++;
      inPosition = false;
    }

    let dayReturn = 0;
    if (inPosition && i > 0) {
      const prev = closes[i - 1] ?? 0;
      dayReturn = prev !== 0 ? (price - prev) / prev : 0;
    }

    dailyReturns.push(dayReturn);
    equity = equity * (1 + dayReturn);
    equityCurve.push({ date_index: i, value: equity });

    if (equity > peakEquity) peakEquity = equity;
    const drawdown = (peakEquity - equity) / peakEquity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const totalReturn = equity / 100 - 1;
  const annualizedReturn = Math.pow(equity / 100, 252 / n) - 1;
  const vol = stddev(dailyReturns) * Math.sqrt(252);
  const winRate = closedTrades > 0 ? winningTrades / closedTrades : 0;
  const first = closes[0] ?? 0;
  const last = closes[n - 1] ?? 0;
  const buyAndHoldReturn = first !== 0 ? (last - first) / first : 0;
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
  };
}

// ----- Signal generation -----

function buildSignals(closes: number[]): SignalLabel[] {
  const signals: SignalLabel[] = ['HOLD'];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1] ?? 0;
    const cur = closes[i] ?? 0;
    const variation_pct = prev !== 0 ? ((cur - prev) / prev) * 100 : 0;
    const res = computeScore({
      code: '',
      closes: closes.slice(0, i + 1),
      variation_pct,
      volume: null,
      avg_volume_30d: null,
    });
    signals.push(res.signal);
  }
  return signals;
}

// ----- Result type -----

export interface BacktestRunResult {
  code: string;
  from: string;
  to: string;
  nbDays: number;
  result: BacktestResult;
  status: 'success' | 'failed' | 'mock';
  message: string | null;
}

// ----- Helpers -----

function pct(v: number): string {
  return (v * 100).toFixed(1) + '%';
}

function logMetrics(
  code: string,
  from: string,
  to: string,
  nbDays: number,
  result: BacktestResult,
): void {
  logger.info(
    {
      code,
      from,
      to,
      nbDays,
      totalReturn: pct(result.totalReturn),
      annualizedReturn: pct(result.annualizedReturn),
      maxDrawdown: pct(-result.maxDrawdown),
      winRate: pct(result.winRate),
      numTrades: result.numTrades,
      sharpeRatio: result.sharpeRatio != null ? result.sharpeRatio.toFixed(2) : null,
      buyAndHoldReturn: pct(result.buyAndHoldReturn),
    },
    'Backtest terminé',
  );
}

const FAILED_RESULT: BacktestResult = {
  equityCurve: [],
  totalReturn: 0,
  annualizedReturn: 0,
  volatility: 0,
  maxDrawdown: 0,
  winRate: 0,
  numTrades: 0,
  buyAndHoldReturn: 0,
  sharpeRatio: null,
};

// ----- Main export -----

export async function runBacktestCmd(opts: {
  code: string;
  from?: string;
  to?: string;
  mock?: boolean;
}): Promise<BacktestRunResult> {
  const { code, from, to, mock } = opts;

  if (mock) {
    const n = 80;
    const closes: number[] = [];
    let price = 1000;
    for (let i = 0; i < n; i++) {
      price = price * (1 + 0.005 * Math.sin(i / 5) + (Math.random() - 0.5) * 0.02);
      closes.push(Math.max(price, 1));
    }

    const signals = buildSignals(closes);
    const result = computeBacktest(closes, signals);
    const fromDate = 'mock-day-0';
    const toDate = `mock-day-${n - 1}`;

    logMetrics(code, fromDate, toDate, n, result);

    return {
      code,
      from: fromDate,
      to: toDate,
      nbDays: n,
      result,
      status: 'mock',
      message: 'Mode mock : série synthétique de 80 clôtures.',
    };
  }

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('brvm_actions_daily')
      .select('code, date_marche, cours_jour')
      .eq('code', code)
      .order('date_marche', { ascending: true })
      .not('cours_jour', 'is', null);

    if (from != null) query = query.gte('date_marche', from);
    if (to != null) query = query.lte('date_marche', to);

    const { data, error } = await query;

    if (error) {
      logger.error({ err: error.message, code }, 'Backtest : erreur Supabase');
      return {
        code,
        from: from ?? '',
        to: to ?? '',
        nbDays: 0,
        result: { ...FAILED_RESULT },
        status: 'failed',
        message: error.message,
      };
    }

    const rows = (data ?? []) as { code: string; date_marche: string; cours_jour: number }[];

    if (rows.length < 2) {
      logger.warn({ code, nbRows: rows.length }, 'Backtest : pas assez de données');
      return {
        code,
        from: from ?? '',
        to: to ?? '',
        nbDays: rows.length,
        result: { ...FAILED_RESULT },
        status: 'failed',
        message: 'Moins de 2 séances disponibles pour ce code/période.',
      };
    }

    const closes = rows.map((r) => r.cours_jour);
    const dates = rows.map((r) => r.date_marche);
    const signals = buildSignals(closes);
    const result = computeBacktest(closes, signals);

    const fromDate = dates[0] ?? '';
    const toDate = dates[dates.length - 1] ?? '';

    logMetrics(code, fromDate, toDate, rows.length, result);

    return {
      code,
      from: fromDate,
      to: toDate,
      nbDays: rows.length,
      result,
      status: 'success',
      message: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg, code }, 'Backtest : exception inattendue');
    return {
      code,
      from: from ?? '',
      to: to ?? '',
      nbDays: 0,
      result: { ...FAILED_RESULT },
      status: 'failed',
      message: msg,
    };
  }
}
