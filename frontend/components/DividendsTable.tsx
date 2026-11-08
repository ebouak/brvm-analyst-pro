'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { DividendRow } from '@/lib/dividends';
import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import { fmtNumber } from '@/lib/format';
import { fmtDateCourte } from '@/lib/dateCourte';
import ExportButton from './ExportButton';
import type { CsvColumn } from '@/lib/export';
import { rendementNetSelonBase } from '@/lib/tax/compute';
import { toPaysUemoa } from '@/lib/tax/rates';

type SortKey = 'code' | 'designation' | 'secteur' | 'pays' | 'montant' | 'rendement_pct' | 'ex_date' | 'payment_date' | 'exercice';

const CSV_COLUMNS: CsvColumn<DividendRow>[] = [
  { header: 'Code', accessor: (r) => r.code },
  { header: 'Désignation', accessor: (r) => r.designation ?? '' },
  { header: 'Secteur', accessor: (r) => r.secteur ?? '' },
  { header: 'Pays', accessor: (r) => r.pays ?? '' },
  { header: 'Montant FCFA', accessor: (r) => r.montant ?? '' },
  { header: 'Rendement %', accessor: (r) => r.rendement_pct ?? '' },
  { header: 'Ex-date', accessor: (r) => r.ex_date ?? '' },
  { header: 'Payment date', accessor: (r) => r.payment_date ?? '' },
  { header: 'Exercice', accessor: (r) => r.exercice ?? '' },
];

function yieldColor(pct: number | null): string {
  if (pct == null) return 'text-muted';
  if (pct >= 8) return 'text-up';
  if (pct >= 4) return 'text-warn';
  return 'text-muted';
}

const PAGE_SIZE = 50;

interface Props {
  rows: DividendRow[];
  years: number[];
  sectors: string[];
}

export default function DividendsTable({ rows, years, sectors }: Props) {
  const [q, setQ] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('ex_date');
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(0);
  // Toggle rendement net d'IRVM (le tri par rendement reste sur la valeur publiée).
  const [net, setNet] = useState(false);

  const filtered = useMemo(() => {
    let r = rows.filter((row) => {
      if (yearFilter && String(row.exercice) !== yearFilter) return false;
      if (sectorFilter && row.secteur !== sectorFilter) return false;
      if (q) {
        const needle = q.toLowerCase();
        if (
          !row.code.toLowerCase().includes(needle) &&
          !(row.designation ?? '').toLowerCase().includes(needle)
        ) return false;
      }
      return true;
    });
    r = [...r].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp: number;
      if (typeof av === 'string' && typeof bv === 'string') {
        cmp = av.localeCompare(bv);
      } else {
        cmp = (av as number) - (bv as number);
      }
      return asc ? cmp : -cmp;
    });
    return r;
  }, [rows, q, yearFilter, sectorFilter, sortKey, asc]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(false); }
    setPage(0);
  }

  function handleFilterChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setter(e.target.value);
      setPage(0);
    };
  }

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-3 py-2 cursor-pointer select-none hover:text-white whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
    >
      {label}
      {sortKey === k && (asc ? <ArrowUp size={12} aria-hidden className="ml-1 inline text-accent-ink" /> : <ArrowDown size={12} aria-hidden className="ml-1 inline text-accent-ink" />)}
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={handleFilterChange(setQ)}
          placeholder="Rechercher ticker ou société…"
          className="bg-surface border border-border rounded px-3 py-1.5 text-sm w-56"
        />
        <select
          aria-label="Filtrer par exercice"
          value={yearFilter}
          onChange={handleFilterChange(setYearFilter)}
          className="bg-surface border border-border rounded px-2 py-1.5 text-sm"
        >
          <option value="">Tous exercices</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <select
          aria-label="Filtrer par secteur"
          value={sectorFilter}
          onChange={handleFilterChange(setSectorFilter)}
          className="bg-surface border border-border rounded px-2 py-1.5 text-sm"
        >
          <option value="">Tous secteurs</option>
          {sectors.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setNet((v) => !v)}
          aria-pressed={net ? 'true' : 'false'}
          className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
            net ? 'border-accent/40 bg-accent/10 text-accent-ink' : 'border-border text-muted hover:text-white'
          }`}
        >
          {net ? <><Check size={12} aria-hidden className="inline mr-1" />Net d’IRVM</> : 'Afficher net d’IRVM'}
        </button>
        <span className="text-xs text-muted ml-auto">
          {filtered.length} dividende{filtered.length !== 1 ? 's' : ''}
        </span>
        <ExportButton<DividendRow>
          filename={`dividendes_${new Date().toISOString().slice(0, 10)}.csv`}
          rows={filtered}
          columns={CSV_COLUMNS}
        />
      </div>

      <div tabIndex={0} role="region" aria-label="Tableau, défilement horizontal" className="bg-surface border border-border rounded-xl overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted border-b border-border bg-bg/40">
            <tr>
              <Th k="code" label="Code" />
              <Th k="designation" label="Société" />
              <Th k="secteur" label="Secteur" />
              <Th k="pays" label="Pays" />
              <Th k="montant" label="Dividende publié (FCFA)" right />
              <Th k="rendement_pct" label={net ? 'Rendement net (%)' : 'Rendement (%)'} right />
              <Th k="ex_date" label="Ex-date" right />
              <Th k="payment_date" label="Paiement" right />
              <Th k="exercice" label="Exercice" right />
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted text-sm">
                  Aucun dividende enregistré pour ces critères.
                </td>
              </tr>
            ) : (
              pageRows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={`border-b border-border/40 hover:bg-bg/40 ${idx % 2 === 1 ? 'bg-bg/20' : ''}`}
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/actions/${row.code}`}
                      className="font-mono font-medium text-ivory hover:text-accent-ink transition-colors"
                    >
                      {row.code}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted max-w-[180px] truncate">
                    {row.designation ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{row.secteur ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted">{row.pays ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular">{row.montant > 0 ? fmtNumber(row.montant, Number.isInteger(row.montant) ? 0 : 2) : '—'}</td>
                  <td className={`px-3 py-2 text-right tabular font-medium ${yieldColor(row.rendement_pct)}`}>
                    {(() => {
                      if (row.rendement_pct == null || !(row.montant > 0)) return '—';
                      if (!net) return fmtNumber(row.rendement_pct, 2);
                      // Un montant déjà net n'est jamais retaxé (double IRVM
                      // corrigée le 2026-10-20) ; une base inconnue n'est pas supposée.
                      const p = toPaysUemoa(row.pays);
                      const r = p
                        ? rendementNetSelonBase(row.rendement_pct, row.base_fiscale, p)
                        : ({ indisponible: true } as const);
                      return r.indisponible
                        ? `${fmtNumber(row.rendement_pct, 2)}*`
                        : fmtNumber(r.valeur, 2);
                    })()}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">{fmtDateCourte(row.ex_date)}</td>
                  <td className="px-3 py-2 text-right text-xs">{fmtDateCourte(row.payment_date)}</td>
                  <td className="px-3 py-2 text-right tabular">{row.exercice ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {net && (
          <p className="px-3 pb-2 pt-1 text-xs text-faint">
            Un montant publié net d&apos;IRVM (calendrier officiel BRVM) est affiché tel quel ; un
            montant brut est réduit de l&apos;IRVM du pays de l&apos;émetteur. * base du montant inconnue
            ou taux non confirmé → montant publié affiché, sans retenue supposée.{' '}
            <Link href="/fiscalite" className="underline underline-offset-2">Détails &amp; sources</Link>.
          </p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded border border-border hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Précédent
          </button>
          <span>
            Page {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 rounded border border-border hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
