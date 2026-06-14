import { describe, it, expect } from 'vitest';
import { runBacktest } from './backtest';
import { synthesizeBacktest, type BenchmarkSet } from './backtest/interpret';
import { toBacktestReport } from './backtest-adapter';

describe('toBacktestReport', () => {
  it('mappe un BacktestResult réel vers BacktestReport (pourcentages, trades, equity)', () => {
    const closes = Array.from({ length: 40 }, (_, i) => 100 + i + (i % 5 === 0 ? -3 : 0));
    const signals = closes.map((_, i) => (i === 1 ? 'BUY' : i === 20 ? 'SELL' : 'HOLD')) as ('BUY' | 'HOLD' | 'SELL')[];
    const dates = closes.map((_, i) => `2026-01-${String((i % 28) + 1).padStart(2, '0')}`);
    const result = runBacktest({ closes, signals, dates, feesPct: 0.006, riskFreeRate: 0.06 });
    const benchmarks: BenchmarkSet = { buyHoldReturn: result.buyAndHoldReturn, indexReturn: 0.05, riskFreeReturn: 0.03 };
    const synthesis = synthesizeBacktest(result, benchmarks, closes.length);

    const report = toBacktestReport({ code: 'TEST', designation: 'Test SA', result, benchmarks, synthesis, dates, feesPct: 0.006, periodLabel: '2 mois' });

    expect(report.meta.instrumentCode).toBe('TEST');
    expect(report.meta.feesPct).toBeCloseTo(0.6, 5);
    expect(report.performance.totalReturnPct).toBeCloseTo(result.totalReturn * 100, 5);
    expect(report.performance.marketReturnPct).toBeCloseTo(5, 5);
    expect(report.risk.maxDrawdownPct).toBeLessThanOrEqual(0); // négatif ou nul
    expect(report.summary.keyMessage).toBe(synthesis.verdict);
    expect(report.equityCurve!.length).toBe(result.equityCurve.length);
    // au moins un trade mappé avec un statut valide
    expect(report.trades.every((t) => ['winner', 'loser', 'open'].includes(t.result))).toBe(true);
  });
});
