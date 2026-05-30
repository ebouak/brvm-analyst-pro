'use client';

import { downloadCSV, type CsvColumn } from '@/lib/export';

interface Props<T> {
  filename: string;
  columns: CsvColumn<T>[];
  rows: T[];
  label?: string;
}

export default function ExportButton<T>({
  filename,
  columns,
  rows,
  label = 'Exporter CSV',
}: Props<T>) {
  return (
    <button
      type="button"
      onClick={() => downloadCSV({ filename, columns, rows })}
      className="text-xs border border-border text-muted rounded px-3 py-1.5 hover:text-up hover:border-up/40 transition flex items-center gap-1"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
      </svg>
      {label}
    </button>
  );
}
