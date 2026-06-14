import type { BacktestStrategyRule } from '@/types/backtest';

export function StrategyRuleCard({ rule }: { rule: BacktestStrategyRule }) {
  const rows = [
    { label: 'On achète quand', value: rule.buyCondition, dot: 'bg-green-500' },
    { label: 'On vend quand', value: rule.sellCondition, dot: 'bg-red-500' },
    { label: 'Sinon', value: rule.holdCondition, dot: 'bg-gray-400' },
  ];
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Règle de la stratégie</p>
      <p className="mt-0.5 text-sm font-medium text-gray-900">{rule.label}</p>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3">
            <span className={`h-2 w-2 shrink-0 rounded-full ${r.dot}`} />
            <span className="text-sm text-gray-500">{r.label}</span>
            <span className="ml-auto text-sm font-medium text-gray-900">{r.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
