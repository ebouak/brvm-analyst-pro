'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { fmtNumber } from '@/lib/format';
import { assessQuality } from '@/lib/fundamentals';

export interface ScreenerRow {
  code: string;
  designation: string | null;
  secteur: string | null;
  per: number | null;
  pb: number | null;
  roe: number | null;
  margeNette: number | null;
  rendementDiv: number | null;
}

type SortKey = 'per' | 'pb' | 'roe' | 'margeNette' | 'rendementDiv';

export default function FundamentalsTable({ rows }: { rows: ScreenerRow[] }) {
  const [sort, setSort] = useState<SortKey>('per');
  const [asc, setAsc] = useState(true);
  const [secteur, setSecteur] = useState<string>('');

  const secteurs = useMemo(() => [...new Set(rows.map((r) => r.secteur).filter(Boolean))] as string[], [rows]);

  const filtered = useMemo(() => {
    const base = secteur ? rows.filter((r) => r.secteur === secteur) : rows;
    return [...base].sort((a, b) => {
      const av = a[sort], bv = b[sort];
      if (av == null) return 1; if (bv == null) return -1;
      return asc ? av - bv : bv - av;
    });
  }, [rows, sort, asc, secteur]);

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="px-3 py-2 text-right cursor-pointer hover:text-up"
      onClick={() => { if (sort === k) setAsc(!asc); else { setSort(k); setAsc(true); } }}>
      {label}{sort === k ? (asc ? ' ▲' : ' ▼') : ''}
    </th>
  );

  const Cell = ({ metric, value, isPct }: { metric: SortKey; value: number | null; isPct?: boolean }) => {
    const q = assessQuality(metric, value);
    if (q === 'missing') return <td className="px-3 py-2 text-right text-muted/60">—</td>;
    const txt = isPct ? `${((value ?? 0) * 100).toFixed(1)} %` : fmtNumber(value, 2);
    return <td className={`px-3 py-2 text-right tabular ${q === 'suspect' ? 'text-warn' : ''}`}>{txt}{q === 'suspect' && ' ⚠️'}</td>;
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setSecteur('')} className={`text-xs px-2 py-1 rounded border ${secteur === '' ? 'border-up text-up' : 'border-border text-muted'}`}>Tous</button>
        {secteurs.map((s) => (
          <button type="button" key={s} onClick={() => setSecteur(s)} className={`text-xs px-2 py-1 rounded border ${secteur === s ? 'border-up text-up' : 'border-border text-muted'}`}>{s}</button>
        ))}
      </div>
      <div className="bg-surface border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted border-b border-border bg-bg/40">
            <tr>
              <th className="px-3 py-2 text-left">Titre</th>
              <Th k="per" label="PER" />
              <Th k="pb" label="P/B" />
              <Th k="roe" label="ROE" />
              <Th k="margeNette" label="Marge" />
              <Th k="rendementDiv" label="Rdt div." />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.code} className="border-b border-border/40 hover:bg-bg/40">
                <td className="px-3 py-2"><Link href={`/actions/${r.code}`} className="font-medium hover:text-up">{r.code}</Link><span className="text-muted text-xs ml-2">{r.secteur}</span></td>
                <Cell metric="per" value={r.per} />
                <Cell metric="pb" value={r.pb} />
                <Cell metric="roe" value={r.roe} isPct />
                <Cell metric="margeNette" value={r.margeNette} isPct />
                <Cell metric="rendementDiv" value={r.rendementDiv} isPct />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted">⚠️ = donnée extraite douteuse (vérifier les états financiers). « — » = non disponible.</p>
    </div>
  );
}
