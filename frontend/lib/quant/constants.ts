import { MODEL_VERSION } from './types';

export const MODEL_VERSION_CURRENT = MODEL_VERSION;

// Price Momentum weights
export const PM_WEIGHTS = {
  m12_1: 0.40,
  m6m: 0.25,
  m3m: 0.15,
  high52w: 0.10,
  trend: 0.10,
} as const;

// Combined Alpha pillar weights
export const CA_WEIGHTS = {
  value: 0.30,
  momentum: 0.25,
  earningsQuality: 0.20,
  financialStrength: 0.15,
  dividendQuality: 0.10,
} as const;

// Liquidity composition
export const LIQUIDITY_WEIGHTS = {
  tradingDays: 0.50,
  avgTradedValue: 0.35,
  volume: 0.15,
} as const;

// Value sub-weights (general)
export const VALUE_WEIGHTS_GENERAL = {
  per: 0.30,
  pb: 0.25,
  divYield: 0.20,
  evEbitda: 0.15,
  earningsYield: 0.10,
} as const;
export const VALUE_WEIGHTS_BANK = { pb: 0.45, pe: 0.25, divYield: 0.20, roeAdj: 0.10 } as const;
export const VALUE_WEIGHTS_INSURANCE = { pb: 0.40, pe: 0.25, divYield: 0.20, roeAdj: 0.15 } as const;

// Earnings Quality
export const EQ_WEIGHTS_GENERAL = { roe: 0.25, epsGrowth3y: 0.20, marginStability: 0.15, cashConv: 0.15, accruals: 0.10, stability: 0.15 } as const;
export const EQ_WEIGHTS_BANK = { roe: 0.30, roa: 0.20, netIncomeGrowth: 0.20, costOfRisk: 0.15, stability: 0.15 } as const;
export const EQ_WEIGHTS_INSURANCE = { roe: 0.30, netIncomeGrowth: 0.20, combinedRatio: 0.20, investmentReturn: 0.15, stability: 0.15 } as const;

// Financial Strength
export const FS_WEIGHTS_GENERAL = { interestCoverage: 0.30, netDebtToEbitda: 0.25, debtToEquity: 0.20, currentRatio: 0.15, fcfToDebt: 0.10 } as const;
export const FS_WEIGHTS_BANK = { capitalAdequacy: 0.30, nplRatio: 0.25, nplCoverage: 0.20, liquidity: 0.15, depositGrowth: 0.10 } as const;
export const FS_WEIGHTS_INSURANCE = { solvency: 0.35, combinedRatio: 0.25, provisionCoverage: 0.20, liquidity: 0.20 } as const;

// Dividend Quality
export const DQ_WEIGHTS = { yield: 0.35, consistency: 0.25, growth: 0.20, payout: 0.20 } as const;

// Thresholds
export const WINSOR_LOWER_P = 5;
export const WINSOR_UPPER_P = 95;
export const MIN_SECTOR_COMPARABLES = 5;
export const MIN_GLOBAL_COMPARABLES = 5;
export const LIQUIDITY_MIN_TRADING_DAYS_90 = 20;
export const LIQUIDITY_PENALTIES = [
  { min: 70, penalty: 0 },
  { min: 50, penalty: 5 },
  { min: 30, penalty: 15 },
  { min: 0, penalty: 30 },
] as const;
export const GLOBAL_RISK_CAP = 25;

// Classifications
export function classifyMomentum(score: number | null): import('./types').QuantClassification {
  if (score == null) return 'Insufficient Data';
  if (score >= 80) return 'Strong Positive Momentum';
  if (score >= 65) return 'Positive Momentum';
  if (score >= 50) return 'Neutral Momentum';
  if (score >= 35) return 'Negative Momentum';
  return 'Strong Negative Momentum';
}
export function classifyCombinedAlpha(score: number | null, confidence: import('./types').ConfidenceLevel): import('./types').QuantClassification {
  if (score == null) return 'Insufficient Data';
  // Never Strong Buy with low/insufficient confidence
  if ((confidence === 'low' || confidence === 'insufficient') && score >= 80) return 'Watchlist / Neutral';
  if (score >= 80) return 'Strong Buy Quant';
  if (score >= 65) return 'Buy Quant';
  if (score >= 50) return 'Watchlist / Neutral';
  if (score >= 35) return 'Reduce / Avoid';
  return 'High Risk / Avoid';
}
