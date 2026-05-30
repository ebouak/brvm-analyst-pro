'use client';

import ExportButton from './ExportButton';
import type { CsvColumn } from '@/lib/export';

export interface PositionRow {
  code: string;
  quantite: number;
  prix_entree: number;
  last: number | null;
  value: number | null;
  pnl: number | null;
  pnlPct: number | null;
}

const CSV_COLUMNS: CsvColumn<PositionRow>[] = [
  { header: 'Code', accessor: (r) => r.code },
  { header: 'Quantité', accessor: (r) => r.quantite },
  { header: 'PRU', accessor: (r) => r.prix_entree },
  { header: 'Cours', accessor: (r) => r.last ?? '' },
  { header: 'Valeur', accessor: (r) => r.value ?? '' },
  { header: 'P&L latent FCFA', accessor: (r) => r.pnl ?? '' },
  { header: 'P&L latent %', accessor: (r) => r.pnlPct != null ? Number(r.pnlPct.toFixed(2)) : '' },
];

export default function PortefeuilleExport({ rows }: { rows: PositionRow[] }) {
  return (
    <ExportButton<PositionRow>
      filename={`portefeuille_${new Date().toISOString().slice(0, 10)}.csv`}
      rows={rows}
      columns={CSV_COLUMNS}
    />
  );
}
