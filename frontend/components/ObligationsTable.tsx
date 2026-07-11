'use client';
import { useMemo, useState } from 'react';
import ExportButton from '@/components/ExportButton';
import type { CsvColumn } from '@/lib/export';

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
  isAmortissable?: boolean;
  /** Émetteur souverain/BOAD/BIDC → coupons exonérés de retenue (YTM = net). */
  couponExonere?: boolean;
}

type SortKey = 'code' | 'taux_pct' | 'ytm' | 'yearsToMaturity';

const CSV_COLUMNS: CsvColumn<ObligationRow>[] = [
  { header: 'Code', accessor: (o) => o.code },
  { header: 'Émetteur', accessor: (o) => o.emetteur ?? '' },
  { header: 'Désignation', accessor: (o) => o.designation ?? '' },
  { header: 'Coupon %', accessor: (o) => o.taux_pct ?? '' },
  { header: 'Échéance', accessor: (o) => o.maturite?.slice(0, 4) ?? '' },
  { header: 'Années restantes', accessor: (o) => o.yearsToMaturity?.toFixed(1) ?? '' },
  { header: 'Prix (FCFA)', accessor: (o) => o.cours_jour ?? '' },
  { header: 'YTM %', accessor: (o) => o.ytm?.toFixed(2) ?? '' },
];

function prixStatus(cours: number | null): { label: string; cls: string } {
  if (cours == null) return { label: '—', cls: 'text-muted' };
  if (cours >= 9500 && cours <= 10500) return { label: 'Au pair', cls: 'text-[#56D7FD]' };
  if (cours > 10500) return { label: 'Surcôté', cls: 'text-[#3fe18b]' };
  if (cours >= 5000) return { label: 'Décoté', cls: 'text-[#ff6b6b]' };
  return { label: 'Amorti', cls: 'text-orange-400' };
}

function maturiteYear(iso: string | null): string {
  if (!iso) return '—';
  return iso.slice(0, 4);
}

export default function ObligationsTable({
  rows,
  title = 'Obligations',
  compact = false,
}: {
  rows: ObligationRow[];
  title?: string;
  compact?: boolean;
}) {
  const [q, setQ] = useState('');
  const [emetteurFilter, setEmetteurFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('ytm');
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(0);
  const PER_PAGE = compact ? 20 : 30;

  const emetteurs = useMemo(
    () => [...new Set(rows.map((r) => r.emetteur).filter(Boolean))].sort() as string[],
    [rows],
  );

  const filtered = useMemo(() => {
    let r = rows.filter((o) => {
      if (emetteurFilter && o.emetteur !== emetteurFilter) return false;
      if (q && !`${o.code} ${o.designation ?? ''} ${o.emetteur ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    r = [...r].sort((a, b) => {
      const av = a[sortKey] ?? (sortKey === 'code' ? '' : -Infinity);
      const bv = b[sortKey] ?? (sortKey === 'code' ? '' : -Infinity);
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return asc ? cmp : -cmp;
    });
    return r;
  }, [rows, emetteurFilter, q, sortKey, asc]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const slice = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(false); }
  }

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-3 py-2 cursor-pointer select-none hover:text-white whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
    >
      {label}
      {sortKey === k && <span className="text-[#56D7FD] ml-1">{asc ? '▲' : '▼'}</span>}
    </th>
  );

  return (
    <div className="space-y-3">
      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          placeholder="Rechercher…"
          className="bg-[#0a1417] border border-[#1a2a30] rounded px-3 py-1.5 text-sm w-44 focus:outline-none focus:border-[#56D7FD]/40"
        />
        <select
          value={emetteurFilter}
          onChange={(e) => { setEmetteurFilter(e.target.value); setPage(0); }}
          aria-label="Filtrer par émetteur"
          className="bg-[#0a1417] border border-[#1a2a30] rounded px-2 py-1.5 text-sm"
        >
          <option value="">Tous émetteurs</option>
          {emetteurs.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <span className="text-xs text-gray-500 ml-auto">
          {filtered.length} / {rows.length} {title.toLowerCase()}
        </span>
        <ExportButton<ObligationRow>
          filename={`obligations_${new Date().toISOString().slice(0, 10)}.csv`}
          rows={filtered}
          columns={CSV_COLUMNS}
        />
      </div>

      {/* Tableau */}
      <div className="bg-[#0a1417] border border-[#1a2a30] rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-xs text-gray-500 border-b border-[#1a2a30]">
            <tr>
              <Th k="code" label="Code" />
              <th className="px-3 py-2 text-left">Émetteur</th>
              <Th k="taux_pct" label="Coupon" right />
              <Th k="yearsToMaturity" label="Échéance" right />
              <th className="px-3 py-2 text-right">Prix</th>
              <Th k="ytm" label="YTM" right />
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-xs">
                  Aucune obligation correspondante
                </td>
              </tr>
            )}
            {slice.map((o) => {
              const { label: pLabel, cls: pCls } = prixStatus(o.cours_jour);
              return (
                <tr key={o.code} className="border-b border-[#1a2a30]/50 hover:bg-[#0f1f24] transition-colors">
                  {/* Code + désignation */}
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-[#56D7FD] text-xs">{o.code}</span>
                    {o.designation && (
                      <div className="text-[10px] text-gray-500 truncate max-w-[160px] mt-0.5">{o.designation}</div>
                    )}
                  </td>
                  {/* Émetteur */}
                  <td className="px-3 py-2.5 text-xs text-gray-300 max-w-[140px] truncate">
                    {o.emetteur ?? '—'}
                  </td>
                  {/* Coupon */}
                  <td className="px-3 py-2.5 text-right font-mono text-xs">
                    {o.taux_pct != null ? `${o.taux_pct.toFixed(2)}%` : '—'}
                  </td>
                  {/* Échéance */}
                  <td className="px-3 py-2.5 text-right">
                    <span className="text-xs">{maturiteYear(o.maturite)}</span>
                    {o.yearsToMaturity != null && (
                      <div className="text-[10px] text-gray-500">{o.yearsToMaturity.toFixed(1)} ans</div>
                    )}
                  </td>
                  {/* Prix + statut */}
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-mono text-xs">
                      {o.cours_jour != null ? o.cours_jour.toLocaleString('fr-FR') : '—'}
                    </span>
                    <div className={`text-[10px] ${pCls}`}>{pLabel}</div>
                  </td>
                  {/* YTM + fiscalité coupon */}
                  <td className="px-3 py-2.5 text-right font-mono text-xs">
                    {o.isAmortissable ? (
                      <span className="text-orange-400/70">N/A</span>
                    ) : o.ytm != null ? (
                      <span className="text-[#3fe18b]">{o.ytm.toFixed(2)}%</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                    <div className={`text-[10px] ${o.couponExonere ? 'text-[#3fe18b]/80' : 'text-gray-500'}`}>
                      {o.couponExonere ? 'net (exonéré)' : 'retenue 2–6 %'}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 text-xs border border-[#1a2a30] rounded hover:border-[#56D7FD]/40 disabled:opacity-30"
          >
            ←
          </button>
          <span className="text-xs text-gray-500">{page + 1} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="px-3 py-1 text-xs border border-[#1a2a30] rounded hover:border-[#56D7FD]/40 disabled:opacity-30"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
