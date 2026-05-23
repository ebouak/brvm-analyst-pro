'use client';
import { useMemo, useState } from 'react';
import { fmtNumber, fmtFcfa } from '@/lib/format';

export interface ObligationRow {
  code: string;
  designation: string | null;
  emetteur: string | null;
  taux_pct: number | null;
  maturite: string | null;
  cours_jour: number | null;
  volume: number | null;
  yearsToMaturity: number | null;
  ytm: number | null;
  modifiedDuration: number | null;
}

type SortKey = 'code' | 'taux_pct' | 'ytm' | 'yearsToMaturity' | 'volume';

export default function ObligationsTable({ rows }: { rows: ObligationRow[] }) {
  const [emetteur, setEmetteur] = useState('');
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('ytm');
  const [asc, setAsc] = useState(false);

  const emetteurs = useMemo(
    () => [...new Set(rows.map((r) => r.emetteur).filter(Boolean))].sort() as string[],
    [rows],
  );

  const list = useMemo(() => {
    let r = rows.filter((o) => {
      if (emetteur && o.emetteur !== emetteur) return false;
      if (q && !`${o.code} ${o.designation ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    r = [...r].sort((a, b) => {
      const av = a[sortKey] ?? (sortKey === 'code' ? '' : 0);
      const bv = b[sortKey] ?? (sortKey === 'code' ? '' : 0);
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return asc ? cmp : -cmp;
    });
    return r;
  }, [rows, emetteur, q, sortKey, asc]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(false); }
  }
  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th onClick={() => toggleSort(k)} className={`px-3 py-2 cursor-pointer select-none hover:text-white ${right ? 'text-right' : 'text-left'}`}>
      {label}{sortKey === k && <span className="text-up ml-1">{asc ? '▲' : '▼'}</span>}
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
          className="bg-surface border border-border rounded px-3 py-1.5 text-sm w-48" />
        <select value={emetteur} onChange={(e) => setEmetteur(e.target.value)} className="bg-surface border border-border rounded px-2 py-1.5 text-sm">
          <option value="">Tous émetteurs</option>
          {emetteurs.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <span className="text-xs text-muted ml-auto">{list.length} obligations</span>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted border-b border-border bg-bg/40">
            <tr>
              <Th k="code" label="Code" />
              <th className="px-3 py-2 text-left">Émetteur</th>
              <Th k="taux_pct" label="Coupon" right />
              <th className="px-3 py-2 text-right">Maturité</th>
              <Th k="yearsToMaturity" label="Années" right />
              <th className="px-3 py-2 text-right">Prix</th>
              <Th k="ytm" label="YTM" right />
              <th className="px-3 py-2 text-right">Dur. mod.</th>
              <Th k="volume" label="Volume" right />
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.code} className="border-b border-border/40 hover:bg-bg/40">
                <td className="px-3 py-2">
                  <div className="font-medium">{o.code}</div>
                  <div className="text-xs text-muted truncate max-w-[180px]">{o.designation}</div>
                </td>
                <td className="px-3 py-2 text-xs text-muted">{o.emetteur ?? '—'}</td>
                <td className="px-3 py-2 text-right tabular">{o.taux_pct != null ? o.taux_pct.toFixed(2) + '%' : '—'}</td>
                <td className="px-3 py-2 text-right tabular text-xs">{o.maturite ?? '—'}</td>
                <td className="px-3 py-2 text-right tabular">{o.yearsToMaturity != null ? o.yearsToMaturity.toFixed(1) : '—'}</td>
                <td className="px-3 py-2 text-right tabular">{fmtNumber(o.cours_jour)}</td>
                <td className="px-3 py-2 text-right tabular text-up">{o.ytm != null ? o.ytm.toFixed(2) + '%' : '—'}</td>
                <td className="px-3 py-2 text-right tabular">{o.modifiedDuration != null ? o.modifiedDuration.toFixed(2) : '—'}</td>
                <td className="px-3 py-2 text-right tabular">{fmtFcfa(o.volume)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
