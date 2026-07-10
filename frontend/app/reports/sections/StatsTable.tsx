'use client';
import { volatility20d, periodReturn } from '@/lib/reportUtils';
import { sma } from '@/lib/indicators';

export interface StatRow {
  code: string;
  designation: string | null;
  closes: number[];
  volumes: (number | null)[];
}

function fmt(v: number | null, digits = 2, suffix = ''): string {
  if (v == null) return '—';
  return `${v.toFixed(digits)}${suffix}`;
}

export default function StatsTable({ rows }: { rows: StatRow[] }) {
  if (rows.length === 0) {
    return (
      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-3">Statistiques clés par titre</h2>
        <p className="text-sm text-muted">Aucune donnée.</p>
      </section>
    );
  }

  return (
    <section className="bg-surface border border-border rounded-xl p-5 space-y-3">
      <h2 className="font-semibold">Statistiques clés par titre</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="pb-2 pr-4">Code</th>
              <th className="pb-2 pr-4 tabular">Rdt période</th>
              <th className="pb-2 pr-4 tabular">Vol. 20j</th>
              <th className="pb-2 pr-4 tabular">Vol. moy.</th>
              <th className="pb-2 tabular">Cours / MA50</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const last = r.closes.length > 0 ? r.closes[r.closes.length - 1] ?? null : null;
              const perf = periodReturn(r.closes);

              const vol20 = volatility20d(r.closes);

              const vols = r.volumes.filter((v): v is number => v != null);
              const avgVol = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : null;

              const ma50 = sma(r.closes, 50);
              const ratio = last && ma50 ? last / ma50 : null;

              return (
                <tr key={r.code} className="hover:bg-bg/40">
                  <td className="py-2 pr-4">
                    <span className="font-medium">{r.code}</span>
                    {r.designation && (
                      <span className="block text-xs text-muted truncate max-w-[12rem]">
                        {r.designation}
                      </span>
                    )}
                  </td>
                  <td
                    className={`py-2 pr-4 tabular text-xs ${
                      perf == null ? '' : perf >= 0 ? 'text-up' : 'text-down'
                    }`}
                  >
                    {perf != null ? `${perf >= 0 ? '+' : ''}${perf.toFixed(2)} %` : '—'}
                  </td>
                  <td className="py-2 pr-4 tabular text-xs">
                    {fmt(vol20 != null ? vol20 * 100 : null, 2, ' %')}
                  </td>
                  <td className="py-2 pr-4 tabular text-xs">
                    {avgVol != null ? Math.round(avgVol).toLocaleString('fr-FR') : '—'}
                  </td>
                  <td className="py-2 tabular text-xs">
                    {ratio != null ? ratio.toFixed(3) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
