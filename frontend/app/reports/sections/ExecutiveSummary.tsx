'use client';
import { topMovers, computeVariation } from '@/lib/reportUtils';

interface Row {
  code: string;
  designation?: string | null;
  variation_pct: number | null;
  cours_jour?: number | null;
}

interface Props {
  rows: Row[];
  dateFrom: string;
  dateTo: string;
}

export default function ExecutiveSummary({ rows, dateFrom, dateTo }: Props) {
  const withVar = rows.filter((r) => r.variation_pct != null);
  const avgVar =
    withVar.length
      ? withVar.reduce((s, r) => s + (r.variation_pct ?? 0), 0) / withVar.length
      : null;

  const hausses = topMovers(rows, 3, 'up');
  const baisses = topMovers(rows, 3, 'down');

  const sign = (v: number) => (v >= 0 ? '+' : '');

  return (
    <section className="bg-surface border border-border rounded-xl p-5 space-y-4">
      <h2 className="font-semibold">Résumé exécutif</h2>
      <p className="text-xs text-muted">
        Période : <span className="tabular">{dateFrom}</span> →{' '}
        <span className="tabular">{dateTo}</span>
      </p>

      {avgVar != null && (
        <p className="text-sm">
          Rendement moyen du marché (période) :{' '}
          <span className={`tabular font-medium ${avgVar >= 0 ? 'text-up' : 'text-down'}`}>
            {sign(avgVar)}{avgVar.toFixed(2)} %
          </span>
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <MoverList label="Top 3 hausses" rows={hausses} color="text-up" />
        <MoverList label="Top 3 baisses" rows={baisses} color="text-down" />
      </div>
    </section>
  );
}

function MoverList({
  label,
  rows,
  color,
}: {
  label: string;
  rows: Row[];
  color: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted mb-1">{label}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted italic">—</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.code} className="flex items-center justify-between text-sm">
              <span className="font-medium">{r.code}</span>
              <span className={`tabular ${color}`}>
                {(r.variation_pct ?? 0) >= 0 ? '+' : ''}
                {(r.variation_pct ?? 0).toFixed(2)} %
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
