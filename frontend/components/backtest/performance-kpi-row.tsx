import type { BacktestPerformance } from '@/types/backtest';
import { formatPercent, getPerformanceTone, toneTextClass } from '@/lib/backtest-formatters';

function Kpi({ label, value, sub, highlight }: { label: string; value: number; sub?: string; highlight?: boolean }) {
  const tone = getPerformanceTone(value);
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-gray-300 bg-gray-50' : 'border-gray-200 bg-white'}`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneTextClass[tone]}`}>{formatPercent(value)}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export function PerformanceKpiRow({ performance }: { performance: BacktestPerformance }) {
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Stratégie" value={performance.totalReturnPct} sub="rendement total" highlight />
        <Kpi label="Buy & Hold" value={performance.buyAndHoldReturnPct} sub="acheter et conserver" />
        <Kpi label="Marché (BRVM-C)" value={performance.marketReturnPct} sub="indice composite" />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 px-1 text-xs text-gray-500">
        <span>Annualisé : <span className="font-medium text-gray-700 tabular-nums">{formatPercent(performance.annualizedReturnPct)}</span></span>
        <span>Sans risque : <span className="font-medium text-gray-700 tabular-nums">{formatPercent(performance.riskFreeReturnPct)}</span></span>
      </div>
    </section>
  );
}
