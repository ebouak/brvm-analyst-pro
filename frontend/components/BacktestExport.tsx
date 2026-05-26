'use client';

interface Props {
  equityCurve: { date_index: number; date?: string; value: number }[];
  closes: number[];
  dates?: string[];
  code: string;
}

export default function BacktestExport({ equityCurve, closes, dates, code }: Props) {
  function exportCSV() {
    const base = closes[0] ?? 1;
    const rows = ['Date,Stratégie,Buy&Hold,Cours'];
    equityCurve.forEach((pt) => {
      const d = dates?.[pt.date_index] ?? pt.date ?? String(pt.date_index);
      const bh = (100 * ((closes[pt.date_index] ?? base) / base)).toFixed(2);
      rows.push(`${d},${pt.value.toFixed(2)},${bh},${closes[pt.date_index] ?? ''}`);
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backtest-${code}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <button
      type="button"
      onClick={exportCSV}
      className="text-xs border border-border text-muted rounded px-3 py-1.5 hover:text-up hover:border-up/40 transition"
    >
      📥 Export CSV
    </button>
  );
}
