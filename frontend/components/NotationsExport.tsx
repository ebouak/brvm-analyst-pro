'use client';

import ExportButton from '@/components/ExportButton';
import type { CsvColumn } from '@/lib/export';
import type { InstrumentNotation } from '@/app/notations/page';

const COLUMNS: CsvColumn<InstrumentNotation>[] = [
  { header: 'Ticker', accessor: (d) => d.ticker },
  { header: 'Société', accessor: (d) => d.name },
  { header: 'Secteur', accessor: (d) => d.sector },
  { header: 'Agence', accessor: (d) => d.agence ?? '' },
  { header: 'Note', accessor: (d) => d.note ?? '' },
  { header: 'Perspective', accessor: (d) => d.history[0]?.perspective ?? '' },
  { header: 'Date notation', accessor: (d) => d.history[0]?.date_notation ?? '' },
];

export default function NotationsExport({ rows }: { rows: InstrumentNotation[] }) {
  return (
    <ExportButton<InstrumentNotation>
      filename={`notations_${new Date().toISOString().slice(0, 10)}.csv`}
      rows={rows.filter((d) => d.note !== null)}
      columns={COLUMNS}
    />
  );
}
