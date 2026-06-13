'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SectorPerf } from '@/lib/sectors';
import { fmtFcfa, fmtNumber } from '@/lib/format';

type Col = 'secteur' | 'count' | 'coursMean' | 'varDay' | 'var5d' | 'var30d' | 'var90d' | 'var1y' | 'volumeDay';

interface Props {
  perfs: SectorPerf[];
}

const COLS: { key: Col; label: string; tooltip: string }[] = [
  { key: 'secteur', label: 'Secteur', tooltip: 'Secteur économique ICB' },
  { key: 'count', label: '# Act.', tooltip: "Nombre d'actions cotées dans ce secteur" },
  { key: 'coursMean', label: 'Cours moy.', tooltip: 'Cours de clôture moyen pondéré des actions du secteur (FCFA)' },
  { key: 'varDay', label: 'Jour %', tooltip: 'Variation moyenne des cours ce jour — moyenne arithmétique des variations individuelles' },
  { key: 'var5d', label: '5j %', tooltip: 'Performance sectorielle sur 5 jours de bourse — variation du cours moyen vs il y a 5 séances' },
  { key: 'var30d', label: '30j %', tooltip: 'Performance sur 30 jours calendaires — bon indicateur de tendance à moyen terme' },
  { key: 'var90d', label: '90j %', tooltip: 'Performance trimestrielle (90 jours calendaires) — tendance structurelle' },
  { key: 'var1y', label: '1A %', tooltip: 'Performance sur 1 an calendaire — reflète le cycle annuel complet' },
  { key: 'volumeDay', label: 'Vol. jour', tooltip: 'Valeur échangée cumulée du secteur ce jour (en FCFA) — mesure la liquidité sectorielle' },
];

function VarCell({ v }: { v: number | null }) {
  if (v == null) return <span className="text-faint">—</span>;
  const cls = v >= 0 ? 'text-up' : 'text-down';
  return (
    <span className={`tabular font-medium ${cls}`}>
      {v >= 0 ? '+' : ''}{v.toFixed(2)}%
    </span>
  );
}

function ColTooltip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-flex items-center ml-1">
      <span className="text-faint/60 text-[9px] cursor-help select-none">(?)</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 w-52 rounded-lg border border-border bg-elevated px-3 py-2 text-xs text-muted leading-relaxed opacity-0 transition-opacity group-hover/tip:opacity-100 shadow-modal"
      >
        {text}
      </span>
    </span>
  );
}

export default function SectorRankingTable({ perfs }: Props) {
  const [sortCol, setSortCol] = useState<Col>('varDay');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(col: Col) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  const sorted = [...perfs].sort((a, b) => {
    const av = a[sortCol];
    const bv = b[sortCol];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === 'string'
      ? av.localeCompare(bv as string)
      : (av as number) - (bv as number);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-elevated/80 border-b border-border">
            {COLS.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left whitespace-nowrap"
              >
                <button
                  type="button"
                  onClick={() => handleSort(col.key)}
                  className="inline-flex items-center gap-0.5 font-medium text-muted hover:text-ivory transition-colors cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-gold/40 rounded"
                  aria-label={`Trier par ${col.label}`}
                >
                  {col.label}
                  {sortCol === col.key ? (
                    <span className="text-gold ml-0.5">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
                  ) : null}
                </button>
                <ColTooltip text={col.tooltip} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, idx) => {
            const href = `/heatmap?secteur=${encodeURIComponent(p.secteur)}`;
            const rowBg = idx % 2 === 0 ? '' : 'bg-elevated/20';
            return (
              <tr key={p.secteur} className={`border-b border-border/50 transition-colors hover:bg-gold/[0.03] ${rowBg}`}>
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  <Link href={href} className="text-gold hover:underline">
                    {p.secteur}
                  </Link>
                </td>
                <td className="px-4 py-3 tabular text-muted">{p.count}</td>
                <td className="px-4 py-3 tabular text-ivory">
                  {p.coursMean != null ? fmtNumber(p.coursMean, 0) : '—'}
                </td>
                <td className="px-4 py-3"><VarCell v={p.varDay} /></td>
                <td className="px-4 py-3"><VarCell v={p.var5d} /></td>
                <td className="px-4 py-3"><VarCell v={p.var30d} /></td>
                <td className="px-4 py-3"><VarCell v={p.var90d} /></td>
                <td className="px-4 py-3"><VarCell v={p.var1y} /></td>
                <td className="px-4 py-3 tabular text-ivory whitespace-nowrap">
                  {fmtFcfa(p.volumeDay)} FCFA
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLS.length} className="px-4 py-8 text-center text-faint">
                Aucune donnée disponible.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
