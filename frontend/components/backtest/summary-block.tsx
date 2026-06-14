import type { BacktestSummary } from '@/types/backtest';

export function SummaryBlock({ summary }: { summary: BacktestSummary }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">À retenir</p>
      <p className="mt-1 text-sm font-medium text-gray-900">{summary.keyMessage}</p>
      <ul className="mt-3 space-y-2">
        {summary.bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
