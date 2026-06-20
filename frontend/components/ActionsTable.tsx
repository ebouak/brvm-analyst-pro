'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ActionDaily, SignalDaily } from '@/lib/types';
import { fmtNumber, fmtFcfa } from '@/lib/format';
import SignalBadge from './SignalBadge';
import Sparkline from './Sparkline';
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

const EASE = 'transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';

/* ── Input/Select atoms ──────────────────────────────────────────────────── */
const inputCls =
  `bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-ivory placeholder:text-faint
   focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 ${EASE}`;

const selectCls =
  `bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-ivory
   focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 ${EASE}`;

export default function ActionsTable({
  actions,
  signals,
  sparklines = {},
}: {
  actions: ActionDaily[];
  signals: Record<string, SignalDaily>;
  sparklines?: Record<string, number[]>;
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

  /* ── Column header with sort indicator ──────────────────────────────── */
  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`
        overline px-4 py-3 cursor-pointer select-none
        text-faint hover:text-gold/80 ${EASE}
        ${right ? 'text-right' : 'text-left'}
        ${sortKey === k ? 'text-gold/70' : ''}
      `}
    >
      {label}
      {sortKey === k && (
        <span className="ml-1 text-gold/60 text-[9px]">{asc ? '▲' : '▼'}</span>
      )}
    </th>
  );

  return (
    <div className="space-y-0">
      {/* ── Barre de filtres ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center px-4 py-3 border-b border-border/60">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher code / nom…"
          className={`${inputCls} w-52`}
        />
        <select value={pays} onChange={(e) => setPays(e.target.value)} className={selectCls}>
          <option value="">Tous pays</option>
          {paysOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={secteur} onChange={(e) => setSecteur(e.target.value)} className={selectCls}>
          <option value="">Tous secteurs</option>
          {secteurOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={perf}
          onChange={(e) => setPerf(e.target.value as 'all' | 'up' | 'down')}
          className={selectCls}
        >
          <option value="all">Toutes perfs</option>
          <option value="up">Hausses</option>
          <option value="down">Baisses</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-muted">
          <span>Vol. min</span>
          <input
            type="number"
            value={minVol}
            onChange={(e) => setMinVol(Number(e.target.value) || 0)}
            className={`${inputCls} w-24 tabular`}
          />
        </label>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-faint tabular">
            <span className="text-ivory font-medium">{rows.length}</span> résultats
          </span>
          {/* ExportButton — wrapper for premium look */}
          <div className={`[&>button]:rounded-lg [&>button]:border-border-strong [&>button]:text-muted [&>button]:px-3 [&>button]:py-1.5 [&>button]:text-xs [&>button]:hover:border-gold/30 [&>button]:hover:text-gold ${EASE}`}>
            <ExportButton<ActionDaily>
              filename={`actions_${new Date().toISOString().slice(0, 10)}.csv`}
              rows={rows}
              columns={CSV_COLUMNS}
            />
          </div>
        </div>
      </div>

      {/* ── Tableau ───────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 bg-bg/60">
            <tr>
              <Th k="code" label="Titre" />
              <th className="overline px-4 py-3 text-left text-faint">Secteur</th>
              <Th k="cours_jour" label="Cours" right />
              <Th k="variation_pct" label="Var %" right />
              <th className="overline px-4 py-3 text-center text-faint">Tendance 30j</th>
              <Th k="volume" label="Volume" right />
              <Th k="valeur_echangee" label="Valeur" right />
              <th className="overline px-4 py-3 text-center text-faint">Signal</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-muted text-sm">
                  Aucun titre ne correspond aux filtres sélectionnés.
                </td>
              </tr>
            )}
            {rows.map((a) => {
              const varPct = a.variation_pct ?? 0;
              const up = varPct >= 0;
              const sig = signals[a.code];
              return (
                <tr
                  key={a.code}
                  className={`border-b border-border/40 hover:bg-white/[0.02] ${EASE} group`}
                >
                  {/* ── Code + Désignation ─────────────────────────────── */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/actions/${a.code}`}
                      className={`flex items-center gap-2.5 hover:text-gold ${EASE}`}
                    >
                      {LOGOS[a.code] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={LOGOS[a.code]}
                          alt={a.code}
                          width={28}
                          height={28}
                          className="w-7 h-7 rounded-md object-contain shrink-0 bg-white/10 p-0.5 border border-border/60"
                        />
                      ) : (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[9px] font-bold shrink-0 bg-gold/10 text-gold/70 border border-gold/20">
                          {a.code.slice(0, 2)}
                        </span>
                      )}
                      <div>
                        <span className="font-semibold text-ivory tracking-wide">{a.code}</span>
                        <div className="text-[11px] text-faint truncate max-w-[160px] leading-tight">
                          {a.designation}
                        </div>
                      </div>
                    </Link>
                  </td>

                  {/* ── Secteur ───────────────────────────────────────── */}
                  <td className="px-4 py-3">
                    {a.secteur ? (
                      <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">
                        {a.secteur}
                      </span>
                    ) : (
                      <span className="text-faint text-xs">—</span>
                    )}
                  </td>

                  {/* ── Cours ─────────────────────────────────────────── */}
                  <td className="px-4 py-3 text-right tabular text-ivory font-medium">
                    {fmtNumber(a.cours_jour)}
                  </td>

                  {/* ── Variation % ───────────────────────────────────── */}
                  <td className={`px-4 py-3 text-right tabular font-semibold ${up ? 'text-up' : 'text-down'}`}>
                    <span className="inline-flex items-center justify-end gap-1">
                      <span className="text-[10px] opacity-70">{up ? '▲' : '▼'}</span>
                      {up ? '+' : ''}{varPct.toFixed(2)}%
                    </span>
                  </td>

                  {/* ── Tendance 30j (sparkline) ──────────────────────── */}
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      {(sparklines[a.code]?.length ?? 0) >= 2 ? (
                        <Sparkline data={sparklines[a.code]!} up={up} width={72} height={24} />
                      ) : (
                        <span className="text-faint text-xs">—</span>
                      )}
                    </div>
                  </td>

                  {/* ── Volume ────────────────────────────────────────── */}
                  <td className="px-4 py-3 text-right tabular text-muted">
                    {fmtNumber(a.volume)}
                  </td>

                  {/* ── Valeur échangée ───────────────────────────────── */}
                  <td className="px-4 py-3 text-right tabular text-muted">
                    {fmtFcfa(a.valeur_echangee)}
                  </td>

                  {/* ── Signal ────────────────────────────────────────── */}
                  <td className="px-4 py-3 text-center">
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
