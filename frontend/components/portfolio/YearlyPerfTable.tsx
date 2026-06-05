'use client';

import { useMemo } from 'react';
import { fmtNumber, fmtFcfa } from '@/lib/format';
import type { MonthlyTrackingEntry } from '@/lib/portfolio/queries';

interface Props {
  data: MonthlyTrackingEntry[] | null;
  isLoading?: boolean;
}

/**
 * Yearly performance table with sparkline.
 *
 * Features:
 * - Rows: 2026→2031 (6 years)
 * - Columns: Année | Indice Début | Indice Fin | Performance | Sparkline
 * - Highlights current year row
 * - Total row at bottom (from first to last month)
 * - Message: "Sur les X mois, tes investissements ont généré XXX FCFA de gains purs."
 *
 * Data: filter portfolio_monthly_tracking for Dec 31 (or last available) of each year.
 * YTD calc: (indiceDecFin / indiceDecPrecMoisDebut) - 1
 */
export default function YearlyPerfTable({ data, isLoading = false }: Props) {
  const result = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        yearRows: [],
        totalRow: null,
        totalMonths: 0,
        pureGains: 0,
      };
    }

    // Sort by date ascending
    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Extract years from 2026 to 2031
    const targetYears = [2026, 2027, 2028, 2029, 2030, 2031];
    const currentYear = new Date().getFullYear();

    // Group entries by year
    const entriesByYear = new Map<number, MonthlyTrackingEntry[]>();
    for (const entry of sorted) {
      const y = new Date(entry.date).getFullYear();
      if (!entriesByYear.has(y)) {
        entriesByYear.set(y, []);
      }
      entriesByYear.get(y)!.push(entry);
    }

    // Build year rows
    const yearRows = targetYears.map((year) => {
      const yearEntries = entriesByYear.get(year) || [];

      if (yearEntries.length === 0) {
        return {
          year,
          indiceDebut: null,
          indiceFin: null,
          performance: null,
          sparklinePoints: [],
          isCurrentYear: year === currentYear,
        };
      }

      // Get first and last entry of the year
      const firstEntry = yearEntries[0];
      const lastEntry = yearEntries[yearEntries.length - 1];

      const indiceDebut = firstEntry.indice_base100 ?? null;
      const indiceFin = lastEntry.indice_base100 ?? null;

      // Performance: (indiceFin / indiceDebut) - 1
      let performance = null;
      if (indiceFin !== null && indiceDebut !== null && indiceDebut !== 0) {
        performance = indiceFin / indiceDebut - 1;
      }

      // Sparkline: monthly indice_base100 values for the year
      const sparklinePoints = yearEntries
        .map((e) => e.indice_base100 ?? null)
        .filter((v) => v !== null) as number[];

      return {
        year,
        indiceDebut,
        indiceFin,
        performance,
        sparklinePoints,
        isCurrentYear: year === currentYear,
      };
    });

    // Total row: from first month overall to last month overall
    let totalRow = null;
    if (sorted.length > 0) {
      const firstEntry = sorted[0];
      const lastEntry = sorted[sorted.length - 1];

      const indiceDebut = firstEntry.indice_base100 ?? null;
      const indiceFin = lastEntry.indice_base100 ?? null;

      let totalPerformance = null;
      if (indiceFin !== null && indiceDebut !== null && indiceDebut !== 0) {
        totalPerformance = indiceFin / indiceDebut - 1;
      }

      // Sparkline: all monthly points
      const sparklinePoints = sorted
        .map((e) => e.indice_base100 ?? null)
        .filter((v) => v !== null) as number[];

      totalRow = {
        indiceDebut,
        indiceFin,
        performance: totalPerformance,
        sparklinePoints,
      };
    }

    // Pure gains: last value - (initial + apports - retraits)
    const totalMonths = sorted.filter((e) => e.valeur_finale !== null).length;
    const lastEntry = sorted[sorted.length - 1];
    const totalApports = sorted.reduce((sum, e) => sum + (e.apports ?? 0), 0);
    const totalRetraits = sorted.reduce((sum, e) => sum + (e.retraits ?? 0), 0);
    const investedCapital = sorted[0].valeur_initiale + totalApports - totalRetraits;
    const pureGains = lastEntry ? (lastEntry.valeur_finale ?? 0) - investedCapital : 0;

    return {
      yearRows,
      totalRow,
      totalMonths,
      pureGains,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-elevated rounded animate-pulse w-96" />
        <div className="h-64 bg-elevated rounded animate-pulse" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-muted rounded-lg bg-surface border border-border">
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-6 space-y-6">
      <h3 className="text-sm font-semibold text-up">📊 Performance par Année</h3>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wide">
                Année
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wide">
                Indice Début
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wide">
                Indice Fin
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wide">
                Performance
              </th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wide">
                Tendance
              </th>
            </tr>
          </thead>
          <tbody>
            {result.yearRows.map((row) => {
              const isCurrentYear = row.year === new Date().getFullYear();
              const rowBgClass = isCurrentYear ? 'bg-elevated' : 'hover:bg-elevated/50';

              return (
                <tr
                  key={row.year}
                  className={`border-b border-border transition-colors ${rowBgClass}`}
                >
                  {/* Année */}
                  <td className="py-3 px-4 font-semibold text-white">
                    {row.year}
                    {isCurrentYear && <span className="text-xs ml-2 text-info">(En cours)</span>}
                  </td>

                  {/* Indice Début */}
                  <td className="text-right py-3 px-4 tabular text-muted">
                    {row.indiceDebut !== null ? fmtNumber(row.indiceDebut, 0) : '—'}
                  </td>

                  {/* Indice Fin */}
                  <td className="text-right py-3 px-4 tabular text-white">
                    {row.indiceFin !== null ? fmtNumber(row.indiceFin, 0) : '—'}
                  </td>

                  {/* Performance */}
                  <td
                    className={`text-right py-3 px-4 tabular font-semibold ${
                      row.performance === null
                        ? 'text-muted'
                        : row.performance >= 0
                          ? 'text-up'
                          : 'text-down'
                    }`}
                  >
                    {row.performance !== null
                      ? `${row.performance >= 0 ? '+' : ''}${(row.performance * 100).toFixed(2)}%`
                      : '—'}
                  </td>

                  {/* Sparkline */}
                  <td className="text-center py-3 px-4">
                    {row.sparklinePoints.length > 0 ? (
                      <Sparkline points={row.sparklinePoints} />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* Total Row */}
            {result.totalRow && (
              <tr className="border-t-2 border-border bg-elevated/50 font-semibold">
                <td className="py-4 px-4 text-white">Total</td>
                <td className="text-right py-4 px-4 tabular text-muted">
                  {result.totalRow.indiceDebut !== null ? fmtNumber(result.totalRow.indiceDebut, 0) : '—'}
                </td>
                <td className="text-right py-4 px-4 tabular text-white">
                  {result.totalRow.indiceFin !== null ? fmtNumber(result.totalRow.indiceFin, 0) : '—'}
                </td>
                <td
                  className={`text-right py-4 px-4 tabular ${
                    result.totalRow.performance === null
                      ? 'text-muted'
                      : result.totalRow.performance >= 0
                        ? 'text-up'
                        : 'text-down'
                  }`}
                >
                  {result.totalRow.performance !== null
                    ? `${result.totalRow.performance >= 0 ? '+' : ''}${(result.totalRow.performance * 100).toFixed(2)}%`
                    : '—'}
                </td>
                <td className="text-center py-4 px-4">
                  {result.totalRow.sparklinePoints.length > 0 ? (
                    <Sparkline points={result.totalRow.sparklinePoints} />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Message Bottom */}
      {result.totalMonths > 0 && (
        <div className="pt-4 border-t border-border text-sm text-muted">
          <p>
            Sur les <span className="font-semibold text-white">{result.totalMonths} mois</span>, tes
            investissements ont généré{' '}
            <span className={`font-semibold ${result.pureGains >= 0 ? 'text-up' : 'text-down'}`}>
              {fmtFcfa(result.pureGains)} FCFA
            </span>{' '}
            de gains purs.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Inline sparkline component (small line chart).
 * Displays 4-5 points as a micro trend visualization.
 */
function Sparkline({ points }: { points: number[] }) {
  if (points.length === 0) return <span className="text-muted">—</span>;

  // Normalize to 0-100 range for SVG rendering
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  // Downsample to max 5 points for display
  const displayPoints = points.length <= 5 ? points : points.filter((_, i) => i % Math.ceil(points.length / 5) === 0);

  const normalized = displayPoints.map((p) => {
    const y = ((p - min) / range) * 80 + 10; // 10-90 SVG y range
    return y;
  });

  // Generate SVG path
  const pathD = normalized
    .map((y, i) => `${(i / (normalized.length - 1 || 1)) * 100} ${y}`)
    .reduce((prev, curr, i) => (i === 0 ? `M ${curr}` : `${prev} L ${curr}`), '');

  const isPositive = displayPoints[displayPoints.length - 1] >= displayPoints[0];
  const lineColor = isPositive ? '#00c853' : '#f44336'; // up vs down

  return (
    <svg width="60" height="32" viewBox="0 0 100 100" className="inline-block">
      <polyline
        points={normalized.map((y, i) => `${(i / (normalized.length - 1 || 1)) * 100},${y}`).join(' ')}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
