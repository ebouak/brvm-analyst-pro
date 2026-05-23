'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { SignalDaily } from '@/lib/types';
import { fmtNumber } from '@/lib/format';
import SignalBadge from './SignalBadge';

export interface SignalRow extends SignalDaily {
  designation: string | null;
  cours_jour: number | null;
  variation_pct: number | null;
}

type Filter = 'ALL' | 'BUY' | 'HOLD' | 'SELL';
type SortKey = 'score_total' | 'confiance' | 'code';

export default function SignalsTable({ rows }: { rows: SignalRow[] }) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('score_total');
  const [asc, setAsc] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => {
    let r = rows.filter((s) => {
      if (filter !== 'ALL' && s.signal !== filter) return false;
      if (q && !`${s.code} ${s.designation ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    r = [...r].sort((a, b) => {
      const av = a[sortKey] ?? (sortKey === 'code' ? '' : 0);
      const bv = b[sortKey] ?? (sortKey === 'code' ? '' : 0);
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return asc ? cmp : -cmp;
    });
    return r;
  }, [rows, filter, q, sortKey, asc]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(false); }
  }

  const FilterBtn = ({ f, label }: { f: Filter; label: string }) => (
    <button onClick={() => setFilter(f)}
      className={`text-xs px-3 py-1 rounded border ${filter === f ? 'border-up text-up' : 'border-border text-muted hover:text-white'}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <FilterBtn f="ALL" label="Tous" />
        <FilterBtn f="BUY" label="Achat" />
        <FilterBtn f="HOLD" label="Conserver" />
        <FilterBtn f="SELL" label="Vendre" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
          className="bg-surface border border-border rounded px-3 py-1.5 text-sm w-48 ml-2" />
        <span className="text-xs text-muted ml-auto">{list.length} signaux</span>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted border-b border-border bg-bg/40">
            <tr>
              <th onClick={() => toggleSort('code')} className="px-3 py-2 text-left cursor-pointer">Code {sortKey === 'code' && (asc ? '▲' : '▼')}</th>
              <th className="px-3 py-2 text-center">Signal</th>
              <th onClick={() => toggleSort('score_total')} className="px-3 py-2 text-right cursor-pointer">Score {sortKey === 'score_total' && (asc ? '▲' : '▼')}</th>
              <th onClick={() => toggleSort('confiance')} className="px-3 py-2 text-right cursor-pointer">Confiance {sortKey === 'confiance' && (asc ? '▲' : '▼')}</th>
              <th className="px-3 py-2 text-right">Cours</th>
              <th className="px-3 py-2 text-center">Détail</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <RowItem key={s.code} s={s} open={open === s.code} onToggle={() => setOpen(open === s.code ? null : s.code)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowItem({ s, open, onToggle }: { s: SignalRow; open: boolean; onToggle: () => void }) {
  const up = (s.variation_pct ?? 0) >= 0;
  return (
    <>
      <tr className="border-b border-border/40 hover:bg-bg/40">
        <td className="px-3 py-2">
          <Link href={`/dashboard/reports/instrument/${s.code}`} className="font-medium hover:text-up">{s.code}</Link>
          <div className="text-xs text-muted truncate max-w-[180px]">{s.designation}</div>
        </td>
        <td className="px-3 py-2 text-center"><SignalBadge signal={s.signal} confiance={s.confiance} small /></td>
        <td className="px-3 py-2 text-right tabular">{fmtNumber(s.score_total, 2)}</td>
        <td className="px-3 py-2 text-right tabular">{s.confiance != null ? Math.round(s.confiance * 100) + '%' : '—'}</td>
        <td className={`px-3 py-2 text-right tabular ${up ? 'text-up' : 'text-down'}`}>{fmtNumber(s.cours_jour)}</td>
        <td className="px-3 py-2 text-center">
          <button onClick={onToggle} className="text-xs text-up hover:underline">{open ? 'Masquer' : 'Pourquoi ?'}</button>
        </td>
      </tr>
      {open && (
        <tr className="bg-bg/30 border-b border-border/40">
          <td colSpan={6} className="px-4 py-3">
            <p className="text-sm text-muted mb-2">{s.explication ?? 'Pas d’explication enregistrée.'}</p>
            <div className="flex flex-wrap gap-3 text-xs tabular">
              <Sub label="Variation" v={s.score_variation} />
              <Sub label="Volume" v={s.score_volume} />
              <Sub label="RSI" v={s.score_rsi} />
              <Sub label="Bonus tendance" v={s.bonus_tendance} />
              <Sub label="Pénalité liquidité" v={s.penalite_liquidite} neg />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Sub({ label, v, neg }: { label: string; v?: number | null; neg?: boolean }) {
  if (v == null) return null;
  const positive = neg ? v <= 0 : v >= 0;
  return (
    <span>
      <span className="text-muted">{label}: </span>
      <span className={positive ? 'text-up' : 'text-down'}>{v >= 0 ? '+' : ''}{v.toFixed(3)}</span>
    </span>
  );
}
