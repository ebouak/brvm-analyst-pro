'use client';

import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import type { ScanRow } from '@/lib/scanner';
import { fmtNumber, fmtFcfa } from '@/lib/format';
import ExportButton from './ExportButton';
import type { CsvColumn } from '@/lib/export';

const SCANNER_CSV_COLUMNS: CsvColumn<ScanRow>[] = [
  { header: 'Code', accessor: (r) => r.code },
  { header: 'Désignation', accessor: (r) => r.designation ?? '' },
  { header: 'Secteur', accessor: (r) => r.secteur ?? '' },
  { header: 'Cours', accessor: (r) => r.cours_jour ?? '' },
  { header: 'Variation %', accessor: (r) => r.variation_pct ?? '' },
  { header: 'RSI', accessor: (r) => r.rsi ?? '' },
  { header: 'MACD', accessor: (r) => r.macd ?? '' },
  { header: 'Volume', accessor: (r) => r.volume ?? '' },
  { header: 'Signal', accessor: (r) => r.signal ?? '' },
  { header: 'Score', accessor: (r) => r.score ?? '' },
  { header: 'Complétude des données %', accessor: (r) => r.confiance ?? '' },
];

type SortKey = keyof Pick<
  ScanRow,
  'code' | 'designation' | 'secteur' | 'cours_jour' | 'variation_pct' | 'rsi' | 'macd' | 'volume' | 'score'
>;

interface Props {
  rows: ScanRow[];
}

function signalBadge(signal: ScanRow['signal']) {
  if (signal === 'BUY')
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-up/15 text-up">Haussier</span>
    );
  if (signal === 'SELL')
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-down/15 text-down">Baissier</span>
    );
  if (signal === 'HOLD')
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-white/10 text-muted">Neutre</span>
    );
  return <span className="text-muted">—</span>;
}

function rsiBadge(rsi: number | null) {
  if (rsi == null) return <span className="text-muted">—</span>;
  const val = fmtNumber(rsi, 1);
  if (rsi < 30) return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-up/15 text-up">{val}</span>;
  if (rsi > 70) return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-down/15 text-down">{val}</span>;
  return <span className="text-muted">{val}</span>;
}

function macdLabel(macd: number | null, macdSignal: number | null) {
  if (macd == null || macdSignal == null) return <span className="text-muted">—</span>;
  if (macd > macdSignal)
    return <span className="inline-flex items-center gap-1 text-up text-xs"><ArrowUp className="h-3 w-3" aria-hidden />Haussier</span>;
  if (macd < macdSignal)
    return <span className="inline-flex items-center gap-1 text-down text-xs"><ArrowDown className="h-3 w-3" aria-hidden />Baissier</span>;
  return <span className="text-muted text-xs">Neutre</span>;
}

function maTrendLabel(row: ScanRow) {
  const p = row.cours_jour;
  if (p == null) return <span className="text-muted">—</span>;
  const tags: string[] = [];
  if (row.ma20 != null && p > row.ma20) tags.push('MA20');
  if (row.ma50 != null && p > row.ma50) tags.push('MA50');
  if (row.ma200 != null && p > row.ma200) tags.push('MA200');
  if (tags.length === 0) return <span className="text-muted text-xs">Sous MAs</span>;
  return (
    <span className="text-up text-xs">{'> ' + tags.join(', ')}</span>
  );
}

function volumeRatioLabel(volume: number | null, avg: number | null) {
  if (volume == null || avg == null || avg === 0) return <span className="text-muted">—</span>;
  const ratio = volume / avg;
  const formatted = fmtNumber(ratio, 1) + '×';
  if (ratio >= 5) return <span className="text-up font-semibold tabular">{formatted}</span>;
  if (ratio >= 2) return <span className="text-warn tabular">{formatted}</span>;
  return <span className="text-muted tabular">{formatted}</span>;
}

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-faint" aria-hidden />;
  return asc ? <ArrowUp className="ml-1 inline h-3 w-3 text-accent-ink" aria-hidden /> : <ArrowDown className="ml-1 inline h-3 w-3 text-accent-ink" aria-hidden />;
}

export default function ScannerResults({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [asc, setAsc] = useState(false);

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return asc ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setAsc((v) => !v);
    else { setSortKey(key); setAsc(false); }
  }

  function Th({ k, label }: { k: SortKey; label: string }) {
    return (
      <th
        className="px-3 py-2 text-left text-xs text-muted cursor-pointer select-none hover:text-white whitespace-nowrap"
        onClick={() => toggleSort(k)}
      >
        {label}<SortIcon active={sortKey === k} asc={asc} />
      </th>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-10 text-center text-muted">
        Aucune action ne correspond aux critères sélectionnés.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">
          <span className="text-ivory font-medium">{rows.length}</span> action{rows.length > 1 ? 's' : ''} trouvée{rows.length > 1 ? 's' : ''}
        </p>
        <ExportButton<ScanRow>
          filename={`scanner_${new Date().toISOString().slice(0, 10)}.csv`}
          rows={sorted}
          columns={SCANNER_CSV_COLUMNS}
        />
      </div>
      <div tabIndex={0} role="region" aria-label="Tableau, défilement horizontal" className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-black/20 border-b border-border">
            <tr>
              <Th k="code" label="Code" />
              <Th k="designation" label="Désignation" />
              <Th k="secteur" label="Secteur" />
              <Th k="cours_jour" label="Cours (FCFA)" />
              <Th k="variation_pct" label="Variation (%)" />
              <Th k="rsi" label="RSI" />
              <th className="px-3 py-2 text-left text-xs text-muted whitespace-nowrap">MACD</th>
              <th className="px-3 py-2 text-left text-xs text-muted whitespace-nowrap">Tendance MA</th>
              <Th k="volume" label="Volume (× moy. 20 j)" />
              <Th k="score" label="Signal" />
              <th className="px-3 py-2 text-left text-xs text-muted">Score (/100)</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((row) => {
              const varPct = row.variation_pct;
              return (
                <tr key={row.code} className="hover:bg-white/5 transition-colors">
                  <td className="px-3 py-2.5 font-mono font-medium text-ivory">{row.code}</td>
                  <td className="px-3 py-2.5 text-muted max-w-[180px] truncate" title={row.designation ?? undefined}>
                    {row.designation ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-muted text-xs">{row.secteur ?? '—'}</td>
                  <td className="px-3 py-2.5 tabular font-semibold">
                    {row.cours_jour != null ? fmtFcfa(row.cours_jour) : '—'}
                  </td>
                  <td className={`px-3 py-2.5 tabular font-semibold ${varPct == null ? 'text-muted' : varPct > 0 ? 'text-up' : varPct < 0 ? 'text-down' : 'text-muted'}`}>
                    {varPct != null ? (varPct > 0 ? '+' : '') + fmtNumber(varPct, 2) + '%' : '—'}
                  </td>
                  <td className="px-3 py-2.5">{rsiBadge(row.rsi)}</td>
                  <td className="px-3 py-2.5">{macdLabel(row.macd, row.macdSignal)}</td>
                  <td className="px-3 py-2.5">{maTrendLabel(row)}</td>
                  <td className="px-3 py-2.5">{volumeRatioLabel(row.volume, row.volumeAvg20)}</td>
                  <td className="px-3 py-2.5">{signalBadge(row.signal)}</td>
                  <td className="px-3 py-2.5 tabular text-muted">
                    {row.score != null ? fmtNumber(row.score, 0) : '—'}
                    {row.confiance != null && (
                      <span className="ml-1 text-xs text-border">({fmtNumber(row.confiance, 0)}%)</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/actions/${row.code}`}
                      className="inline-flex items-center gap-1 text-xs text-accent-ink hover:underline whitespace-nowrap"
                    >
                      Fiche<ArrowRight className="h-3 w-3" aria-hidden />
                    </Link>
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
