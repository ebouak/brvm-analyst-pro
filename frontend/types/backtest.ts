export type RiskLevel = 'low' | 'medium' | 'high';

export interface BacktestPerformance {
  totalReturnPct: number;
  annualizedReturnPct: number;
  buyAndHoldReturnPct: number;
  marketReturnPct: number;
  riskFreeReturnPct: number;
}

export interface BacktestRisk {
  maxDrawdownPct: number;
  volatilityPct: number;
  sharpe?: number;
  sortino?: number;
  calmar?: number;
  winRatePct?: number;
  riskLevel?: RiskLevel;
}

export interface BacktestTrade {
  id: number;
  entryDate: string;
  exitDate: string | null;
  durationDays: number;
  returnPct: number;
  result: 'winner' | 'loser' | 'open';
}

export interface BacktestMeta {
  instrumentCode: string;
  instrumentName: string;
  startDate: string;
  endDate: string;
  periodLabel: string;
  feesPct: number;
  tradesCount: number;
  isShortHistory: boolean;
}

export interface BacktestStrategyRule {
  label: string;
  buyCondition: string;
  sellCondition: string;
  holdCondition: string;
}

export interface BacktestSummary {
  keyMessage: string;
  bullets: string[];
  warning?: string;
}

export interface BacktestReport {
  meta: BacktestMeta;
  performance: BacktestPerformance;
  risk: BacktestRisk;
  trades: BacktestTrade[];
  strategyRule: BacktestStrategyRule;
  summary: BacktestSummary;
  /** Courbe d'équité (base 100) — optionnelle, pour le mini-sparkline. */
  equityCurve?: number[];
}

export type BacktestInfographicVariant = 'full' | 'compact';

export interface BacktestInfographicProps {
  report: BacktestReport;
  variant?: BacktestInfographicVariant;
  className?: string;
  showRiskDetails?: boolean;
  highlightShortHistory?: boolean;
}
