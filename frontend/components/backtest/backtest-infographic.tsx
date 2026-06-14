import type { BacktestInfographicProps } from '@/types/backtest';
import { BacktestHeader } from './backtest-header';
import { StrategyRuleCard } from './strategy-rule-card';
import { PerformanceKpiRow } from './performance-kpi-row';
import { RiskBlock } from './risk-block';
import { SummaryBlock } from './summary-block';
import { LegalDisclaimer } from './legal-disclaimer';
import { BacktestTradesMiniTable } from './backtest-trades-mini-table';

/**
 * Infographie de backtest — système clair, pédagogique et premium.
 *  - variant « compact » : header + KPI + à retenir (pour un dashboard).
 *  - variant « full » : tous les blocs + table des trades (pour un rapport).
 */
export function BacktestInfographic({
  report,
  variant = 'full',
  className = '',
  showRiskDetails = true,
  highlightShortHistory = true,
}: BacktestInfographicProps) {
  const isFull = variant === 'full';

  return (
    <article className={`mx-auto w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 ${className}`}>
      <div className="space-y-5">
        <BacktestHeader meta={report.meta} highlightShortHistory={highlightShortHistory} />

        <PerformanceKpiRow performance={report.performance} />

        {isFull && <StrategyRuleCard rule={report.strategyRule} />}

        <RiskBlock risk={report.risk} showRiskDetails={isFull && showRiskDetails} />

        <SummaryBlock summary={report.summary} />

        {isFull && <BacktestTradesMiniTable trades={report.trades} />}

        <LegalDisclaimer text={report.summary.warning} />
      </div>
    </article>
  );
}
