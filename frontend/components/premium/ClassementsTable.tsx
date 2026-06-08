'use client';
import { useState } from 'react';
import type { LigneClassement, CritereClassement } from '@/lib/premium/classements';

const CRITERES: { id: CritereClassement; label: string }[] = [
  { id: 'performance',     label: 'Performance' },
  { id: 'liquidite',       label: 'Liquidité' },
  { id: 'volatilite',      label: 'Volatilité' },
  { id: 'valeur_echangee', label: 'Valeur échangée' },
  { id: 'marge_nette',     label: 'Marge nette' },
  { id: 'taux_rotation',   label: 'Rotation' },
  { id: 'reserve',         label: 'Réserve' },
  { id: 'per',             label: 'PER' },
  { id: 'pbr',             label: 'PBR' },
];

const SIGNAL_COLOR: Record<string, string> = {
  BUY: 'text-up bg-up/10', HOLD: 'text-warn bg-warn/10', SELL: 'text-down bg-down/10',
};

export function ClassementsTable({
  data,
  critereInit,
}: {
  data: Record<CritereClassement, LigneClassement[]>;
  critereInit: CritereClassement;
}) {
  const [critere, setCritere] = useState<CritereClassement>(critereInit);
  const [secteurFilter, setSecteurFilter] = useState('');
  const [asc, setAsc] = useState(false);

  const rows = data[critere] ?? [];
  const secteurs = [...new Set(rows.map((r) => r.secteur).filter(Boolean))] as string[];
  const filtered = rows.filter((r) => !secteurFilter || r.secteur === secteurFilter);
  const sorted = asc ? [...filtered].reverse() : filtered;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {CRITERES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => { setCritere(c.id); setSecteurFilter(''); setAsc(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              critere === c.id
                ? 'bg-accent text-white'
                : 'bg-surface border border-border text-muted hover:text-white hover:border-accent/30'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <select
          value={secteurFilter}
          onChange={(e) => setSecteurFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-surface border border-border text-muted text-xs focus:outline-none focus:border-accent"
        >
          <option value="">Tous les secteurs</option>
          {secteurs.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setAsc((a) => !a)}
          className="px-3 py-1.5 rounded-lg bg-surface border border-border text-muted text-xs hover:text-white transition-colors"
        >
          {asc ? '▲ Croissant' : '▼ Décroissant'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-elevated border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider w-8">Rang</th>
              <th className="text-left px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">Symbole</th>
              <th className="text-left px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">Société</th>
              <th className="text-left px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider hidden md:table-cell">Secteur</th>
              <th className="text-right px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">Signal</th>
              <th className="text-right px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">
                {CRITERES.find((c) => c.id === critere)?.label}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.code} className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${i % 2 === 1 ? 'bg-surface/30' : ''}`}>
                <td className="px-4 py-2.5 text-faint tabular text-xs">{i + 1}</td>
                <td className="px-4 py-2.5">
                  <a href={`/actions/${row.code}`} className="font-mono font-semibold text-accent hover:text-white transition-colors text-sm">
                    {row.code}
                  </a>
                </td>
                <td className="px-4 py-2.5 text-white text-xs">{row.designation}</td>
                <td className="px-4 py-2.5 text-muted text-xs hidden md:table-cell">{row.secteur ?? '—'}</td>
                <td className="px-4 py-2.5 text-right">
                  {row.signal ? (
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${SIGNAL_COLOR[row.signal] ?? 'text-muted bg-surface'}`}>
                      {row.signal}
                    </span>
                  ) : <span className="text-faint text-xs">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right tabular text-sm font-semibold text-white">
                  {row.valeur_label}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="py-10 text-center text-muted text-sm">Aucune donnée disponible.</div>
        )}
      </div>
    </div>
  );
}
