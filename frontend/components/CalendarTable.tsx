'use client';

import Link from 'next/link';
import { useState } from 'react';
import { iconForKind, libelleType, montantDividende, type CalendarItem } from '@/lib/calendarHelpers';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import { fmtDateCourte } from '@/lib/dateCourte';

type SortKey = 'date' | 'kind' | 'code' | 'societe' | 'pays';

/** Vue liste du calendrier : triable au clavier (boutons d'en-tête, aria-sort). */
export default function CalendarTable({ items }: { items: CalendarItem[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  if (items.length === 0) return null;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
  }

  const sorted = [...items].sort((a, b) => {
    const va = a[sortKey] ?? '';
    const vb = b[sortKey] ?? '';
    return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir;
  });

  const th = (key: SortKey, label: string) => (
    <th
      key={key}
      scope="col"
      aria-sort={sortKey === key ? (sortDir === 1 ? 'ascending' : 'descending') : 'none'}
      className="px-1 py-1 text-left font-normal whitespace-nowrap"
    >
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${sortKey === key ? 'text-ivory' : 'text-muted'}`}
      >
        {label}
        {sortKey === key && (sortDir === 1 ? <ArrowUp size={12} aria-hidden className="text-accent-ink" /> : <ArrowDown size={12} aria-hidden className="text-accent-ink" />)}
      </button>
    </th>
  );

  return (
    <div tabIndex={0} role="region" aria-label="Tableau, défilement horizontal" className="overflow-x-auto rounded-card border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <table className="w-full text-sm">
        <thead className="border-b border-border">
          <tr>
            {th('date', 'Date')}
            {th('kind', 'Type')}
            {th('code', 'Code')}
            {th('societe', 'Société')}
            <th scope="col" className="px-3 py-2 text-left text-xs font-normal text-muted">Détail</th>
            {th('pays', 'Pays')}
            <th scope="col" className="w-10 px-3 py-2"><span className="sr-only">Lien</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {sorted.map((item) => {
            const Icon = iconForKind(item.kind);
            return (
              <tr key={item.id} className="transition-colors hover:bg-white/[0.02]">
                <td className="tabular whitespace-nowrap px-3 py-2.5 text-muted">{fmtDateCourte(item.date)}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs text-ivory/90">
                    <Icon size={13} strokeWidth={1.75} aria-hidden className="text-muted" />
                    {libelleType(item.kind)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-medium text-ivory">{item.code ?? ''}</td>
                <td className="max-w-[180px] truncate whitespace-nowrap px-3 py-2.5 text-ivory/90">{item.societe ?? ''}</td>
                <td className="max-w-[260px] px-3 py-2.5 text-muted">
                  <span className="block truncate">{item.detail}</span>
                  {item.montant != null && (
                    <span className="tabular text-xs text-ivory">{montantDividende(item.montant)} FCFA par action</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">{item.pays ?? ''}</td>
                <td className="px-3 py-2.5 text-right">
                  {item.href && (
                    <Link href={item.href} className="inline-flex rounded text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`Voir le détail${item.code ? ` de ${item.code}` : ''}`}>
                      <ArrowRight size={14} aria-hidden />
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
