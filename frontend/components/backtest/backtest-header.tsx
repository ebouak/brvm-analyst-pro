import type { BacktestMeta } from '@/types/backtest';
import { formatDate } from '@/lib/backtest-formatters';

export function BacktestHeader({ meta, highlightShortHistory = true }: { meta: BacktestMeta; highlightShortHistory?: boolean }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-gray-900 px-2 py-0.5 font-mono text-xs font-semibold text-white">{meta.instrumentCode}</span>
          <h2 className="truncate text-lg font-semibold text-gray-900">{meta.instrumentName}</h2>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Du {formatDate(meta.startDate)} au {formatDate(meta.endDate)} · {meta.periodLabel}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {highlightShortHistory && meta.isShortHistory && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            ⚠ Historique court
          </span>
        )}
        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
          {meta.tradesCount} trade{meta.tradesCount > 1 ? 's' : ''}
        </span>
        {meta.feesPct > 0 && (
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
            frais {meta.feesPct.toFixed(2).replace('.', ',')} %
          </span>
        )}
      </div>
    </header>
  );
}
