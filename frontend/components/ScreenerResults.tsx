'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ActionRow } from '@/lib/screener/filters';

type SortKey = keyof ActionRow;

export default function ScreenerResults({ results }: { results: ActionRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('score_signal');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = [...results].sort((a, b) => {
    const aVal = a[sortKey] ?? 0;
    const bVal = b[sortKey] ?? 0;

    let cmp = 0;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      cmp = aVal - bVal;
    } else if (typeof aVal === 'string' && typeof bVal === 'string') {
      cmp = aVal.localeCompare(bVal);
    }

    return sortDir === 'desc' ? -cmp : cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const formatNumber = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '—';
    return val.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (results.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center">
        <p className="text-muted">Aucune action ne correspond à vos critères.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs text-muted">
          {results.length} action{results.length > 1 ? 's' : ''} trouvée{results.length > 1 ? 's' : ''}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <SortableTh label="Code" k="code" align="left" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Prix" k="cours_jour" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Var %" k="variation_pct" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="RSI" k="rsi" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Score" k="score_signal" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Div %" k="rendement_dividende" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th className="px-4 py-2 text-right text-muted font-normal">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.code}
                className="border-b border-border/50 last:border-0 hover:bg-white/2 transition"
              >
                <td className="px-4 py-2 text-ivory font-semibold">
                  <Link href={`/actions/${r.code}`} className="hover:text-accent transition">
                    {r.code}
                  </Link>
                </td>
                <td className="px-4 py-2 text-right tabular">
                  {r.cours_jour ? formatNumber(r.cours_jour) : '—'}
                </td>
                <td
                  className={`px-4 py-2 text-right ${
                    r.variation_pct != null
                      ? r.variation_pct >= 0
                        ? 'text-up'
                        : 'text-down'
                      : ''
                  }`}
                >
                  {r.variation_pct != null ? (r.variation_pct >= 0 ? '+' : '') + r.variation_pct.toFixed(2) : '—'}%
                </td>
                <td className="px-4 py-2 text-right">
                  {r.rsi != null ? r.rsi.toFixed(1) : '—'}
                </td>
                <td className="px-4 py-2 text-right">
                  {r.score_signal != null ? r.score_signal.toFixed(0) : '—'}
                </td>
                <td className="px-4 py-2 text-right">
                  {r.rendement_dividende != null ? r.rendement_dividende.toFixed(2) : '—'}%
                </td>
                <td className="px-4 py-2 text-right">
                  <button type="button" className="text-accent text-xs hover:underline transition">
                    + Favoris
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** En-tête de colonne triable, accessible au clavier (bouton + aria-sort). */
function SortableTh({
  label,
  k,
  align,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  k: SortKey;
  align: 'left' | 'right';
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <th
      scope="col"
      aria-sort={active ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
      className={`px-4 py-2 text-muted font-normal ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 hover:text-ivory transition focus:outline-none focus:ring-1 focus:ring-accent/50 rounded ${align === 'right' ? 'flex-row-reverse' : ''} ${active ? 'text-ivory' : ''}`}
      >
        <span>{label}</span>
        {active && <span aria-hidden="true">{sortDir === 'desc' ? '▼' : '▲'}</span>}
      </button>
    </th>
  );
}
