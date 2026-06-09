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
      {/* Critère tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {CRITERES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => { setCritere(c.id); setSecteurFilter(''); setAsc(false); }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              critere === c.id
                ? 'bg-gold text-obsidian shadow-gold'
                : 'bg-elevated border border-border text-muted hover:text-ivory hover:border-gold/30'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        <select
          value={secteurFilter}
          onChange={(e) => setSecteurFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-elevated border border-border text-muted text-xs focus:outline-none focus:border-gold/40 transition-colors"
        >
          <option value="">Tous les secteurs</option>
          {secteurs.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setAsc((a) => !a)}
          className="px-3 py-1.5 rounded-lg bg-elevated border border-border text-muted text-xs hover:text-ivory hover:border-gold/30 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        >
          {asc ? '▲ Croissant' : '▼ Décroissant'}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-elevated/80 border-b border-border">
              <th className="text-left px-4 py-3 text-[10px] text-faint font-semibold uppercase tracking-widest w-8">Rang</th>
              <th className="text-left px-4 py-3 text-[10px] text-faint font-semibold uppercase tracking-widest">Symbole</th>
              <th className="text-left px-4 py-3 text-[10px] text-faint font-semibold uppercase tracking-widest">Société</th>
              <th className="text-left px-4 py-3 text-[10px] text-faint font-semibold uppercase tracking-widest hidden md:table-cell">Secteur</th>
              <th className="text-right px-4 py-3 text-[10px] text-faint font-semibold uppercase tracking-widest">Signal</th>
              <th className="text-right px-4 py-3 text-[10px] text-gold font-semibold uppercase tracking-widest">
                {CRITERES.find((c) => c.id === critere)?.label}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={row.code}
                className={`border-b border-border/40 transition-all duration-200 hover:bg-gold/[0.03] hover:border-gold/20 ${i % 2 === 1 ? 'bg-surface/20' : ''}`}
              >
                <td className="px-4 py-3 text-faint tabular text-xs font-medium">{i + 1}</td>
                <td className="px-4 py-3">
                  <a href={`/actions/${row.code}`} className="font-mono font-semibold text-gold hover:text-gold-soft transition-colors text-sm">
                    {row.code}
                  </a>
                </td>
                <td className="px-4 py-3 text-ivory text-xs">{row.designation}</td>
                <td className="px-4 py-3 text-muted text-xs hidden md:table-cell">{row.secteur ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  {row.signal ? (
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${SIGNAL_COLOR[row.signal] ?? 'border-border bg-elevated text-muted'}`}>
                      {row.signal}
                    </span>
                  ) : <span className="text-faint text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-right tabular text-sm font-semibold text-ivory">
                  {row.valeur_label}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="py-12 text-center">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-gold/20 bg-gold/[0.06] text-gold/60 text-base mb-3">◇</div>
            <p className="text-muted text-sm">Aucune donnée disponible.</p>
          </div>
        )}
      </div>
    </div>
  );
}
