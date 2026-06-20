'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ActionRow } from '@/lib/screener/filters';
import ExportButton from '@/components/ExportButton';
import type { CsvColumn } from '@/lib/export';

type SortKey = keyof ActionRow;

const CSV_COLUMNS: CsvColumn<ActionRow>[] = [
  { header: 'Code', accessor: (r) => r.code },
  { header: 'Secteur', accessor: (r) => r.secteur ?? '' },
  { header: 'Cours', accessor: (r) => r.cours_jour ?? '' },
  { header: 'Variation %', accessor: (r) => r.variation_pct ?? '' },
  { header: 'RSI', accessor: (r) => r.rsi ?? '' },
  { header: 'Score', accessor: (r) => r.score_signal ?? '' },
  { header: 'Rendement dividende %', accessor: (r) => r.rendement_dividende ?? '' },
  { header: 'Volume', accessor: (r) => r.volume ?? '' },
];

/** Couleur RSI : <30 survente (vert), >70 surachat (rouge), sinon neutre. */
function rsiClass(rsi: number | null): string {
  if (rsi == null) return 'text-faint';
  if (rsi < 30) return 'text-up';
  if (rsi > 70) return 'text-down';
  return 'text-muted';
}
/** Couleur score : ≥60 favorable, ≤40 défavorable. */
function scoreClass(s: number | null): string {
  if (s == null) return 'text-faint';
  if (s >= 60) return 'text-up';
  if (s <= 40) return 'text-down';
  return 'text-muted';
}

export default function ScreenerResults({ results }: { results: ActionRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('score_signal');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = [...results].sort((a, b) => {
    const aVal = a[sortKey] ?? 0;
    const bVal = b[sortKey] ?? 0;
    let cmp = 0;
    if (typeof aVal === 'number' && typeof bVal === 'number') cmp = aVal - bVal;
    else if (typeof aVal === 'string' && typeof bVal === 'string') cmp = aVal.localeCompare(bVal);
    return sortDir === 'desc' ? -cmp : cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const fmt = (val: number | null | undefined): string =>
    val == null ? '—' : val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (results.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-10 text-center">
        <p className="text-2xl mb-2" aria-hidden>◎</p>
        <p className="text-white font-medium">Aucune action ne correspond</p>
        <p className="text-sm text-muted mt-1">Assouplissez vos critères ou choisissez un autre preset.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <p className="text-xs text-muted">
          <span className="text-white font-medium">{results.length}</span> action{results.length > 1 ? 's' : ''} trouvée{results.length > 1 ? 's' : ''}
        </p>
        <ExportButton<ActionRow>
          filename={`screener_${new Date().toISOString().slice(0, 10)}.csv`}
          rows={sorted}
          columns={CSV_COLUMNS}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-bg/40">
              <SortableTh label="Code" k="code" align="left" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th className="px-4 py-2 text-left text-muted font-normal hidden sm:table-cell">Secteur</th>
              <SortableTh label="Prix" k="cours_jour" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Var %" k="variation_pct" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="RSI" k="rsi" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Score" k="score_signal" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Div %" k="rendement_dividende" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th className="px-4 py-2 text-right text-muted font-normal"><span className="sr-only">Lien fiche</span></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.code} className="border-b border-border/50 last:border-0 hover:bg-white/[0.02] transition">
                <td className="px-4 py-2.5">
                  <Link href={`/actions/${r.code}`} className="text-ivory font-semibold hover:text-accent transition">
                    {r.code}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-muted hidden sm:table-cell">
                  {r.secteur ? <span className="rounded-full border border-border px-2 py-0.5 text-[10px]">{r.secteur}</span> : '—'}
                </td>
                <td className="px-4 py-2.5 text-right tabular text-ivory">{r.cours_jour ? fmt(r.cours_jour) : '—'}</td>
                <td className={`px-4 py-2.5 text-right tabular font-medium ${r.variation_pct != null ? (r.variation_pct >= 0 ? 'text-up' : 'text-down') : 'text-faint'}`}>
                  {r.variation_pct != null ? `${r.variation_pct >= 0 ? '+' : ''}${r.variation_pct.toFixed(2)}` : '—'}%
                </td>
                <td className={`px-4 py-2.5 text-right tabular font-medium ${rsiClass(r.rsi)}`}>
                  {r.rsi != null ? r.rsi.toFixed(0) : '—'}
                </td>
                <td className={`px-4 py-2.5 text-right tabular font-semibold ${scoreClass(r.score_signal)}`}>
                  {r.score_signal != null ? r.score_signal.toFixed(0) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right tabular text-muted">
                  {r.rendement_dividende != null ? `${r.rendement_dividende.toFixed(2)}%` : '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/actions/${r.code}`} className="text-accent text-xs hover:underline transition whitespace-nowrap">
                    Fiche →
                  </Link>
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
  label, k, align, sortKey, sortDir, onSort,
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
