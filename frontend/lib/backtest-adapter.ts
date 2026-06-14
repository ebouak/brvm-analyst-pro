/**
 * Adaptateur : transforme un BacktestResult (moteur lib/backtest.ts) + benchmarks
 * + synthèse en BacktestReport pour l'infographie pédagogique (thème clair).
 * Fonction pure et testable.
 */
import type { BacktestResult } from './backtest';
import type { BenchmarkSet, BacktestSynthesis } from './backtest/interpret';
import type { BacktestReport, RiskLevel } from '@/types/backtest';

function riskLevel(r: BacktestResult): RiskLevel {
  if (r.maxDrawdown > 0.30) return 'high';
  if (r.maxDrawdown < 0.15 && (r.sharpeRatio == null || r.sharpeRatio >= 1)) return 'low';
  return 'medium';
}

export interface AdapterInput {
  code: string;
  designation: string;
  result: BacktestResult;
  benchmarks: BenchmarkSet;
  synthesis: BacktestSynthesis;
  dates: string[];
  feesPct: number;
  periodLabel: string;
}

export function toBacktestReport(inp: AdapterInput): BacktestReport {
  const { result: r, benchmarks: b, synthesis: s, dates } = inp;
  const start = dates[0] ?? '';
  const end = dates[dates.length - 1] ?? '';

  return {
    meta: {
      instrumentCode: inp.code,
      instrumentName: inp.designation,
      startDate: start,
      endDate: end,
      periodLabel: inp.periodLabel,
      feesPct: inp.feesPct * 100,
      tradesCount: r.numTrades,
      isShortHistory: r.numTrades < 10,
    },
    performance: {
      totalReturnPct: r.totalReturn * 100,
      annualizedReturnPct: r.annualizedReturn * 100,
      buyAndHoldReturnPct: r.buyAndHoldReturn * 100,
      marketReturnPct: (b.indexReturn ?? 0) * 100,
      riskFreeReturnPct: b.riskFreeReturn * 100,
    },
    risk: {
      maxDrawdownPct: -r.maxDrawdown * 100,
      volatilityPct: r.volatility * 100,
      sharpe: r.sharpeRatio ?? undefined,
      sortino: r.sortinoRatio ?? undefined,
      calmar: r.calmarRatio ?? undefined,
      winRatePct: r.winRate * 100,
      riskLevel: riskLevel(r),
    },
    trades: r.trades.map((t, i) => ({
      id: i + 1,
      entryDate: t.entryDate ?? '',
      exitDate: t.exitDate ?? null,
      durationDays: t.bars ?? 0,
      returnPct: (t.returnPct ?? 0) * 100,
      result: t.exitIndex == null ? 'open' : t.win ? 'winner' : 'loser',
    })),
    strategyRule: {
      label: 'Signal momentum : variation du cours',
      buyCondition: 'variation > 2 % → ACHAT',
      sellCondition: 'variation < -2 % → VENTE',
      holdCondition: 'sinon → CONSERVER',
    },
    summary: {
      keyMessage: s.verdict,
      bullets: [...s.rationale.slice(0, 2), ...s.cautions.slice(0, 1)].slice(0, 3),
      warning: 'Les performances passées ne garantissent pas les performances futures.',
    },
    equityCurve: r.equityCurve.map((p) => p.value),
  };
}
