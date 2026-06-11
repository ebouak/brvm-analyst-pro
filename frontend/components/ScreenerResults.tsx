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
              <th
                className="px-4 py-2 text-left text-muted font-normal cursor-pointer hover:text-ivory"
                onClick={() => toggleSort('code')}
              >
                Code {sortKey === 'code' && (sortDir === 'desc' ? '▼' : '▲')}
              </th>
              <th
                className="px-4 py-2 text-right text-muted font-normal cursor-pointer hover:text-ivory tabular"
                onClick={() => toggleSort('cours_jour')}
              >
                Prix {sortKey === 'cours_jour' && (sortDir === 'desc' ? '▼' : '▲')}
              </th>
              <th
                className="px-4 py-2 text-right text-muted font-normal cursor-pointer hover:text-ivory"
                onClick={() => toggleSort('variation_pct')}
              >
                Var % {sortKey === 'variation_pct' && (sortDir === 'desc' ? '▼' : '▲')}
              </th>
              <th
                className="px-4 py-2 text-right text-muted font-normal cursor-pointer hover:text-ivory"
                onClick={() => toggleSort('rsi')}
              >
                RSI {sortKey === 'rsi' && (sortDir === 'desc' ? '▼' : '▲')}
              </th>
              <th
                className="px-4 py-2 text-right text-muted font-normal cursor-pointer hover:text-ivory"
                onClick={() => toggleSort('score_signal')}
              >
                Score {sortKey === 'score_signal' && (sortDir === 'desc' ? '▼' : '▲')}
              </th>
              <th
                className="px-4 py-2 text-right text-muted font-normal cursor-pointer hover:text-ivory"
                onClick={() => toggleSort('rendement_dividende')}
              >
                Div % {sortKey === 'rendement_dividende' && (sortDir === 'desc' ? '▼' : '▲')}
              </th>
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
