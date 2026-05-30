'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SectorPerf } from '@/lib/sectors';
import { fmtFcfa, fmtNumber } from '@/lib/format';

type Col = 'secteur' | 'count' | 'coursMean' | 'varDay' | 'var5d' | 'var30d' | 'var90d' | 'var1y' | 'volumeDay';

interface Props {
  perfs: SectorPerf[];
}

const COLS: { key: Col; label: string }[] = [
  { key: 'secteur', label: 'Secteur' },
  { key: 'count', label: '# Act.' },
  { key: 'coursMean', label: 'Cours moy.' },
  { key: 'varDay', label: 'Jour %' },
  { key: 'var5d', label: '5j %' },
  { key: 'var30d', label: '30j %' },
  { key: 'var90d', label: '90j %' },
  { key: 'var1y', label: '1A %' },
  { key: 'volumeDay', label: 'Vol. jour' },
];

function VarCell({ v }: { v: number | null }) {
  if (v == null) return <span className="text-[#8b93a7]">—</span>;
  const color = v >= 0 ? '#00c853' : '#f44336';
  return (
    <span className="tabular-nums font-medium" style={{ color }}>
      {v >= 0 ? '+' : ''}{v.toFixed(2)}%
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
    <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid #232733' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#161922', borderBottom: '1px solid #232733' }}>
            {COLS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="px-4 py-3 text-left font-medium text-[#8b93a7] cursor-pointer select-none whitespace-nowrap hover:text-[#e6e9f0] transition-colors"
              >
                {col.label}
                {sortCol === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const href = `/actions?secteur=${encodeURIComponent(p.secteur)}`;
            return (
              <tr
                key={p.secteur}
                className="border-b transition-colors hover:bg-[#1a1f2b]"
                style={{ borderColor: '#232733' }}
              >
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={href}
                    className="text-[#42a5f5] hover:underline whitespace-nowrap"
                  >
                    {p.secteur}
                  </Link>
                </td>
                <td className="px-4 py-3 tabular-nums text-[#e6e9f0]">{p.count}</td>
                <td className="px-4 py-3 tabular-nums text-[#e6e9f0]">
                  {p.coursMean != null ? fmtNumber(p.coursMean, 0) : '—'}
                </td>
                <td className="px-4 py-3"><VarCell v={p.varDay} /></td>
                <td className="px-4 py-3"><VarCell v={p.var5d} /></td>
                <td className="px-4 py-3"><VarCell v={p.var30d} /></td>
                <td className="px-4 py-3"><VarCell v={p.var90d} /></td>
                <td className="px-4 py-3"><VarCell v={p.var1y} /></td>
                <td className="px-4 py-3 tabular-nums text-[#e6e9f0] whitespace-nowrap">
                  {fmtFcfa(p.volumeDay)} FCFA
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLS.length} className="px-4 py-8 text-center text-[#8b93a7]">
                Aucune donnée disponible.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
