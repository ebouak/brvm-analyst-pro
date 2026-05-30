'use client';

import { downloadCSV } from '@/lib/export';

interface Props {
  equityCurve: { date_index: number; date?: string; value: number }[];
  closes: number[];
  dates?: string[];
  code: string;
}

export default function BacktestExport({ equityCurve, closes, dates, code }: Props) {
  function exportCSV() {
    const base = closes[0] ?? 1;
    downloadCSV({
      filename: `backtest-${code}-${new Date().toISOString().slice(0, 10)}.csv`,
      separator: ',',
      columns: [
        { header: 'Date', accessor: (pt) => dates?.[pt.date_index] ?? pt.date ?? String(pt.date_index) },
        { header: 'Stratégie', accessor: (pt) => Number(pt.value.toFixed(2)) },
        { header: 'Buy&Hold', accessor: (pt) => Number((100 * ((closes[pt.date_index] ?? base) / base)).toFixed(2)) },
        { header: 'Cours', accessor: (pt) => closes[pt.date_index] ?? '' },
      ],
      rows: equityCurve,
    });
  }

  return (
    <button
      type="button"
      onClick={exportCSV}
      className="text-xs border border-border text-muted rounded px-3 py-1.5 hover:text-up hover:border-up/40 transition flex items-center gap-1"
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
      </svg>
      Export CSV
    </button>
  );
}
