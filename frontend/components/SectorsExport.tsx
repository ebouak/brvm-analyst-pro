'use client';

import ExportButton from '@/components/ExportButton';
import type { CsvColumn } from '@/lib/export';
import type { SectorPerf } from '@/lib/sectors';

const COLUMNS: CsvColumn<SectorPerf>[] = [
  { header: 'Secteur', accessor: (s) => s.secteur },
  { header: 'Nb valeurs', accessor: (s) => s.count },
  { header: 'Cours moyen', accessor: (s) => s.coursMean ?? '' },
  { header: 'Var séance %', accessor: (s) => s.varDay ?? '' },
  { header: 'Var 5 jours %', accessor: (s) => s.var5d ?? '' },
  { header: 'Var 30 jours %', accessor: (s) => s.var30d ?? '' },
  { header: 'Var 90 jours %', accessor: (s) => s.var90d ?? '' },
  { header: 'Var 1 an %', accessor: (s) => s.var1y ?? '' },
  { header: 'Valeur échangée FCFA', accessor: (s) => s.volumeDay },
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
