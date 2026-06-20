'use client';

import ExportButton from '@/components/ExportButton';
import type { CsvColumn } from '@/lib/export';
import type { SectorPerf } from '@/lib/sectors';

const COLUMNS: CsvColumn<SectorPerf>[] = [
  { header: 'Secteur', accessor: (s) => s.secteur },
  { header: 'Nb titres', accessor: (s) => s.count },
  { header: 'Cours moyen', accessor: (s) => s.coursMean ?? '' },
  { header: 'Var jour %', accessor: (s) => s.varDay ?? '' },
  { header: 'Var 5j %', accessor: (s) => s.var5d ?? '' },
  { header: 'Var 30j %', accessor: (s) => s.var30d ?? '' },
  { header: 'Var 90j %', accessor: (s) => s.var90d ?? '' },
  { header: 'Var 1an %', accessor: (s) => s.var1y ?? '' },
  { header: 'Volume jour', accessor: (s) => s.volumeDay },
  { header: 'Hausses', accessor: (s) => s.hausses },
  { header: 'Baisses', accessor: (s) => s.baisses },
];

export default function SectorsExport({ rows }: { rows: SectorPerf[] }) {
  return (
    <ExportButton<SectorPerf>
      filename={`secteurs_${new Date().toISOString().slice(0, 10)}.csv`}
      rows={rows}
      columns={COLUMNS}
    />
  );
}
