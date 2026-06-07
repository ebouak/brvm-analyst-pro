'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ActionDaily, SignalDaily } from '@/lib/types';
import { fmtNumber, fmtFcfa } from '@/lib/format';
import SignalBadge from './SignalBadge';
import ExportButton from './ExportButton';
import type { CsvColumn } from '@/lib/export';
import brvmLogos from '@/lib/brvmLogos.json';

const LOGOS = brvmLogos as Record<string, string>;

type SortKey = 'code' | 'variation_pct' | 'cours_jour' | 'volume' | 'valeur_echangee';

const CSV_COLUMNS: CsvColumn<ActionDaily>[] = [
  { header: 'Code', accessor: (r) => r.code },
  { header: 'Désignation', accessor: (r) => r.designation ?? '' },
  { header: 'Secteur', accessor: (r) => r.secteur ?? '' },
  { header: 'Pays', accessor: (r) => r.pays ?? '' },
  { header: 'Cours', accessor: (r) => r.cours_jour ?? '' },
  { header: 'Variation %', accessor: (r) => r.variation_pct ?? '' },
  { header: 'Volume', accessor: (r) => r.volume ?? '' },
  { header: 'Valeur échangée', accessor: (r) => r.valeur_echangee ?? '' },
];

export default function ActionsTable({
  actions,
  signals,
}: {
  actions: ActionDaily[];
  signals: Record<string, SignalDaily>;
}) {
  const [q, setQ] = useState('');
  const [pays, setPays] = useState('');
  const [secteur, setSecteur] = useState('');
  const [minVol, setMinVol] = useState(0);
  const [perf, setPerf] = useState<'all' | 'up' | 'down'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('variation_pct');
  const [asc, setAsc] = useState(false);

  const paysOptions = useMemo(
    () => [...new Set(actions.map((a) => a.pays).filter(Boolean))].sort() as string[],
    [actions],
  );
  const secteurOptions = useMemo(
    () => [...new Set(actions.map((a) => a.secteur).filter(Boolean))].sort() as string[],
    [actions],
  );

  const rows = useMemo(() => {
    let r = actions.filter((a) => {
      if (q && !`${a.code} ${a.designation ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (pays && a.pays !== pays) return false;
      if (secteur && a.secteur !== secteur) return false;
      if ((a.volume ?? 0) < minVol) return false;
      if (perf === 'up' && (a.variation_pct ?? 0) <= 0) return false;
      if (perf === 'down' && (a.variation_pct ?? 0) >= 0) return false;
      return true;
    });
    r = [...r].sort((a, b) => {
      const av = a[sortKey] ?? (sortKey === 'code' ? '' : 0);
      const bv = b[sortKey] ?? (sortKey === 'code' ? '' : 0);
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return asc ? cmp : -cmp;
    });
    return r;
  }, [actions, q, pays, secteur, minVol, perf, sortKey, asc]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(false); }
  }

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-3 py-2 cursor-pointer select-none hover:text-white ${right ? 'text-right' : 'text-left'}`}
    >
      {label}
      {sortKey === k && <span className="text-up ml-1">{asc ? '▲' : '▼'}</span>}
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher code / nom…"
          className="bg-surface border border-border rounded px-3 py-1.5 text-sm w-56"
        />
        <select value={pays} onChange={(e) => setPays(e.target.value)} className="bg-surface border border-border rounded px-2 py-1.5 text-sm">
          <option value="">Tous pays</option>
          {paysOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={secteur} onChange={(e) => setSecteur(e.target.value)} className="bg-surface border border-border rounded px-2 py-1.5 text-sm">
          <option value="">Tous secteurs</option>
          {secteurOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={perf} onChange={(e) => setPerf(e.target.value as 'all' | 'up' | 'down')} className="bg-surface border border-border rounded px-2 py-1.5 text-sm">
          <option value="all">Toutes perfs</option>
          <option value="up">Hausses</option>
          <option value="down">Baisses</option>
        </select>
        <label className="text-xs text-muted flex items-center gap-1">
          Vol. min
          <input type="number" value={minVol} onChange={(e) => setMinVol(Number(e.target.value) || 0)} className="bg-surface border border-border rounded px-2 py-1 text-sm w-24 tabular" />
        </label>
        <span className="text-xs text-muted ml-auto">{rows.length} résultats</span>
        <ExportButton<ActionDaily>
          filename={`actions_${new Date().toISOString().slice(0, 10)}.csv`}
          rows={rows}
          columns={CSV_COLUMNS}
        />
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted border-b border-border bg-bg/40">
            <tr>
              <Th k="code" label="Code" />
              <th className="px-3 py-2 text-left">Secteur</th>
              <Th k="cours_jour" label="Cours" right />
              <Th k="variation_pct" label="Var %" right />
              <Th k="volume" label="Volume" right />
              <Th k="valeur_echangee" label="Valeur" right />
              <th className="px-3 py-2 text-center">Signal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const up = (a.variation_pct ?? 0) >= 0;
              const sig = signals[a.code];
              return (
                <tr key={a.code} className="border-b border-border/40 hover:bg-bg/40">
                  <td className="px-3 py-2">
                    <Link href={`/actions/${a.code}`} className="flex items-center gap-2 hover:text-up">
                      {LOGOS[a.code] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={LOGOS[a.code]} alt={a.code} width={24} height={24} className="w-6 h-6 rounded object-contain shrink-0 bg-white p-px" />
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded text-[9px] font-bold shrink-0 bg-border text-faint">{a.code.slice(0,2)}</span>
                      )}
                      <span className="font-medium">{a.code}</span>
                    </Link>
                    <div className="text-xs text-muted truncate max-w-[180px] ml-8">{a.designation}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{a.secteur ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular">{fmtNumber(a.cours_jour)}</td>
                  <td className={`px-3 py-2 text-right tabular ${up ? 'text-up' : 'text-down'}`}>
                    {up ? '+' : ''}{(a.variation_pct ?? 0).toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular">{fmtNumber(a.volume)}</td>
                  <td className="px-3 py-2 text-right tabular">{fmtFcfa(a.valeur_echangee)}</td>
                  <td className="px-3 py-2 text-center">
                    <SignalBadge signal={sig?.signal} confiance={sig?.confiance} small />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
