'use client';

import Link from 'next/link';
import { useState } from 'react';
import { iconForKind, colorForKind, type CalendarItem } from '@/lib/calendarHelpers';
import { fmtFcfa, fmtDateFR } from '@/lib/format';

type SortKey = 'date' | 'kind' | 'code' | 'societe' | 'pays';

function kindLabel(kind: CalendarItem['kind']): string {
  switch (kind) {
    case 'ex-date': return 'Ex-date';
    case 'payment': return 'Paiement';
    case 'AG': return 'Assemblée';
    case 'RESULTAT': return 'Résultat';
    case 'COMMUNIQUE': return 'Communiqué';
    case 'INTRODUCTION': return 'Introduction';
    default: return 'Autre';
  }
}

export default function CalendarTable({ items }: { items: CalendarItem[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-muted">
        <p className="text-lg mb-2">Aucun événement prévu dans cette période.</p>
        <Link href="/dashboard" className="text-blue hover:underline text-sm">
          ← Retour au dashboard
        </Link>
      </div>
    );
  }

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
      onClick={() => toggleSort(key)}
      className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wide cursor-pointer hover:text-white whitespace-nowrap select-none"
    >
      {label}
      {sortKey === key && <span className="ml-1">{sortDir === 1 ? '↑' : '↓'}</span>}
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface border-b border-border">
          <tr>
            {th('date', 'Date')}
            {th('kind', 'Type')}
            {th('code', 'Code')}
            {th('societe', 'Société')}
            <th className="px-3 py-2 text-xs font-medium text-muted uppercase tracking-wide text-left">Détail</th>
            {th('pays', 'Pays')}
            <th className="px-3 py-2 w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((item) => {
            const borderClass = colorForKind(item.kind);
            return (
              <tr key={item.id} className="hover:bg-surface/60 transition-colors">
                <td className="px-3 py-2 tabular text-muted whitespace-nowrap">{fmtDateFR(item.date)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border-l-2 bg-surface ${borderClass}`}>
                    {iconForKind(item.kind)} {kindLabel(item.kind)}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-blue whitespace-nowrap">{item.code ?? '—'}</td>
                <td className="px-3 py-2 font-medium whitespace-nowrap max-w-[160px] truncate">{item.societe ?? '—'}</td>
                <td className="px-3 py-2 text-muted max-w-[200px] truncate">
                  {item.detail}
                  {item.montant != null && (
                    <span className="ml-2 text-warn tabular">+{fmtFcfa(item.montant)} FCFA</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">{item.pays ?? '—'}</td>
                <td className="px-3 py-2 text-right">
                  {item.href && (
                    <Link href={item.href} className="text-blue hover:underline text-xs">→</Link>
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
