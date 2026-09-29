// Westbourse Combined Alpha — types quantitatifs
// Score quantitatif propriétaire de Westbourse, indicatif et non constitutif d’un conseil en investissement.

export const MODEL_VERSION = '1.0.0' as const;
export const LEGAL_NOTICE = 'Score quantitatif propriétaire de Westbourse, indicatif et non constitutif d’un conseil en investissement.' as const;

export type Sector =
  | 'banks'
  | 'insurance'
  | 'telecom'
  | 'utilities'
  | 'consumer'
  | 'industrial'
  | 'energy'
  | 'agriculture'
  | 'holding'
  | 'other';

export type EligibilityStatus = 'eligible' | 'eligible_with_warning' | 'ineligible';
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient';

export type QuantClassification =
  | 'Strong Positive Momentum'
  | 'Positive Momentum'
  | 'Neutral Momentum'
  | 'Negative Momentum'
  | 'Strong Negative Momentum'
  | 'Strong Buy Quant'
  | 'Buy Quant'
  | 'Watchlist / Neutral'
  | 'Reduce / Avoid'
  | 'High Risk / Avoid'
  | 'Insufficient Data';

export type ModelCode = 'WB_PRICE_MOMENTUM' | 'WB_COMBINED_ALPHA';

export interface FactorScore {
  value: number | null;
  percentile: number | null;
  weight: number;
  weightedScore: number | null;
  source: string;
  notes: string[];
}

export interface Penalty {
  code: string;
  label: string;
  points: number;
  reason: string;
}

export interface DataCoverage {
  requiredFields: number;
  availableFields: number;
  coverageRate: number;
  missingFields: string[];
}

export interface QuantScoreResult {
  securityId: string;
  symbol: string;
  scoreDate: string;
  modelCode: ModelCode;
  modelVersion: string;
  sector: Sector;
  eligibilityStatus: EligibilityStatus;
  confidenceLevel: ConfidenceLevel;
  score: number | null;
  classification: QuantClassification;
  globalRank: number | null;
  sectorRank: number | null;
  factorScores: Record<string, FactorScore>;
  penalties: Penalty[];
  dataCoverage: DataCoverage;
  calculationNotes: string[];
  updatedAt: string;
}

export interface PriceMomentumInputs {
  symbol: string;
  closes: { date: string; close: number }[]; // triés ascendant
  volumes?: { date: string; volume: number | null; tradedValue: number | null }[];
  spreadBps?: number | null;
}

export interface RawMetrics {
  per?: number | null;
  pb?: number | null;
  dividendYield?: number | null;
  evEbitda?: number | null;
  earningsYield?: number | null;
  roe?: number | null;
  roa?: number | null;
  epsGrowth3y?: number | null;
  marginStability?: number | null;
  cashConversion?: number | null;
  accruals?: number | null;
  earningsStability?: number | null;
  interestCoverage?: number | null;
  netDebtToEbitda?: number | null;
  debtToEquity?: number | null;
  currentRatio?: number | null;
  fcfToDebt?: number | null;
  // bank/insurance overrides
  capitalAdequacy?: number | null;
  nplRatio?: number | null;
  nplCoverage?: number | null;
  liquidityRatio?: number | null;
  depositGrowth?: number | null;
  loanGrowth?: number | null;
  solvencyRatio?: number | null;
  combinedRatio?: number | null;
  investmentReturn?: number | null;
  provisionCoverage?: number | null;
  // dividend
  dividendConsistency?: number | null;
  dividendGrowth?: number | null;
  payoutRatio?: number | null;
}

export interface CombinedAlphaInputs {
  symbol: string;
  sector: Sector;
  priceMomentumScore: number | null;
  rawMetrics: RawMetrics;
  marketCap?: number | null;
  // flags for penalties
  hasNegativeEquity?: boolean;
  consecutiveLosses?: number;
  hasRecentFinancials?: boolean;
  isVeryIlliquid?: boolean;
  dividendUnsustainable?: boolean;
  debtDegradation?: boolean;
  missingCriticalData?: boolean;
}
