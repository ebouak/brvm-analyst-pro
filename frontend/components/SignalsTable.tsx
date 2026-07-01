'use client';
import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import type { SignalDaily } from '@/lib/types';
import { fmtNumber } from '@/lib/format';
import SignalBadge from './SignalBadge';
import RatingBadge from './RatingBadge';
import ExportButton from './ExportButton';
import type { CsvColumn } from '@/lib/export';
import brvmLogos from '@/lib/brvmLogos.json';

const LOGOS = brvmLogos as Record<string, string>;

const SIGNAL_CSV_COLUMNS: CsvColumn<SignalRow>[] = [
  { header: 'Code', accessor: (r) => r.code },
  { header: 'Date', accessor: (r) => r.date_marche },
  { header: 'Signal', accessor: (r) => r.signal },
  { header: 'Score', accessor: (r) => r.score_total ?? '' },
  { header: 'Confiance', accessor: (r) => r.confiance != null ? Number((r.confiance * 100).toFixed(1)) : '' },
  { header: 'Explication', accessor: (r) => r.explication ?? '' },
  { header: 'Secteur', accessor: (r) => r.secteur ?? '' },
  { header: 'Pays', accessor: (r) => r.pays ?? '' },
];

export interface SignalRow extends SignalDaily {
  designation: string | null;
  cours_jour: number | null;
  variation_pct: number | null;
  secteur?: string | null;
  pays?: string | null;
}

type SignalFilter = 'ALL' | 'BUY' | 'HOLD' | 'SELL';
type SortKey = 'score_total' | 'confiance' | 'code';

const SIG_PILLS: {
  value: SignalFilter;
  key: 'all' | 'buy' | 'hold' | 'sell';
  label: string;
  activeCls: string;
  idleCls: string;
}[] = [
  { value: 'ALL', key: 'all', label: 'Tous', activeCls: 'bg-white/10 text-white border-white/30', idleCls: 'border-border text-muted hover:text-white' },
  { value: 'BUY', key: 'buy', label: '🟢 Acheter', activeCls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', idleCls: 'border-emerald-500/20 text-emerald-400/70 hover:text-emerald-400' },
  { value: 'HOLD', key: 'hold', label: '⚪ Conserver', activeCls: 'bg-white/10 text-white border-white/30', idleCls: 'border-border text-muted hover:text-white' },
  { value: 'SELL', key: 'sell', label: '🔴 Vendre', activeCls: 'bg-red-500/20 text-red-400 border-red-500/40', idleCls: 'border-red-500/20 text-red-400/70 hover:text-red-400' },
];

// ─── Composante principale ─────────────────────────────────────────────────
export default function SignalsTable({ rows }: { rows: SignalRow[] }) {
  const [sigFilter, setSigFilter]   = useState<SignalFilter>('ALL');
  const [secteur, setSecteur]       = useState('');
  const [pays, setPays]             = useState('');
  const [minConf, setMinConf]       = useState(0);
  const [q, setQ]                   = useState('');
  const [sortKey, setSortKey]       = useState<SortKey>('score_total');
  const [asc, setAsc]               = useState(false);
  const [modal, setModal]           = useState<SignalRow | null>(null);
  const [page, setPage]             = useState(1);
  const PER_PAGE = 15;

  // Options secteur / pays
  const secteurs = useMemo(() =>
    [...new Set(rows.map((r) => r.secteur).filter(Boolean) as string[])].sort(), [rows]);
  const paysList = useMemo(() =>
    [...new Set(rows.map((r) => r.pays).filter(Boolean) as string[])].sort(), [rows]);

  // Compteurs par signal (sur l'ensemble, pour les pills de filtre rapide).
  const counts = useMemo(() => {
    let buy = 0, hold = 0, sell = 0;
    for (const r of rows) {
      if (r.signal === 'BUY') buy++;
      else if (r.signal === 'HOLD') hold++;
      else if (r.signal === 'SELL') sell++;
    }
    return { all: rows.length, buy, hold, sell };
  }, [rows]);

  const filtered = useMemo(() => {
    let r = rows.filter((s) => {
      if (sigFilter !== 'ALL' && s.signal !== sigFilter) return false;
      if (secteur && s.secteur !== secteur) return false;
      if (pays && s.pays !== pays) return false;
      if (minConf > 0 && (s.confiance ?? 0) < minConf / 100) return false;
      if (q) {
        const txt = `${s.code} ${s.designation ?? ''} ${s.secteur ?? ''}`.toLowerCase();
        if (!txt.includes(q.toLowerCase())) return false;
      }
      return true;
    });
    r = [...r].sort((a, b) => {
      const av = a[sortKey] ?? (sortKey === 'code' ? '' : 0);
      const bv = b[sortKey] ?? (sortKey === 'code' ? '' : 0);
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return asc ? cmp : -cmp;
    });
    return r;
  }, [rows, sigFilter, secteur, pays, minConf, q, sortKey, asc]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(false); }
    setPage(1);
  }

  const reset = useCallback(() => {
    setSigFilter('ALL'); setSecteur(''); setPays(''); setMinConf(0); setQ(''); setPage(1);
  }, []);

  const openModal = useCallback((s: SignalRow) => setModal(s), []);

  return (
    <>
      {/* ── Filtres ── */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold">🔍 Filtres</h3>

        {/* Pills de filtre rapide par signal (avec compteurs réels) */}
        <div className="flex flex-wrap gap-2">
          {SIG_PILLS.map((p) => {
            const active = sigFilter === p.value;
            return (
              <button
                key={p.value}
                type="button"
                aria-pressed={active}
                onClick={() => { setSigFilter(p.value); setPage(1); }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? p.activeCls : p.idleCls}`}
              >
                {p.label} <span className="tabular opacity-75">({counts[p.key]})</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Secteur */}
          <select
            aria-label="Filtrer par secteur"
            value={secteur}
            onChange={(e) => { setSecteur(e.target.value); setPage(1); }}
            className="bg-bg border border-border rounded px-2 py-1.5 text-sm text-white focus:border-up/50 outline-none"
          >
            <option value="">Secteur : Tous</option>
            {secteurs.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Pays */}
          <select
            aria-label="Filtrer par pays"
            value={pays}
            onChange={(e) => { setPays(e.target.value); setPage(1); }}
            className="bg-bg border border-border rounded px-2 py-1.5 text-sm text-white focus:border-up/50 outline-none"
          >
            <option value="">Pays : Tous</option>
            {paysList.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* Recherche */}
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Rechercher…"
            className="bg-bg border border-border rounded px-3 py-1.5 text-sm w-36 focus:border-up/50 outline-none"
          />
        </div>

        {/* Slider confiance */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted whitespace-nowrap">
            Confiance min : <span className="tabular text-white font-medium">{minConf}%</span>
          </label>
          <input
            type="range" min={0} max={100} step={5}
            aria-label="Confiance minimum"
            value={minConf}
            onChange={(e) => { setMinConf(Number(e.target.value)); setPage(1); }}
            className="flex-1 h-1 accent-[#00c853]"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted border border-border rounded px-3 py-1.5 hover:text-white hover:border-up/30 transition"
          >
            Reset
          </button>
          <span className="text-xs text-muted self-center ml-auto">
            {filtered.length} signal{filtered.length !== 1 ? 's' : ''}
          </span>
          <ExportButton<SignalRow>
            filename={`signaux_${new Date().toISOString().slice(0, 10)}.csv`}
            rows={filtered}
            columns={SIGNAL_CSV_COLUMNS}
          />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {paged.length === 0 ? (
          <div className="p-10 text-center text-muted text-sm">
            Aucun signal ne correspond aux filtres sélectionnés.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted border-b border-border bg-bg/40">
                  <tr>
                    <th className="px-3 py-2 text-center w-16">Signal</th>
                    <th onClick={() => toggleSort('code')} className="px-3 py-2 text-left cursor-pointer hover:text-white">
                      Instrument {sortKey === 'code' && (asc ? '▲' : '▼')}
                    </th>
                    <th onClick={() => toggleSort('score_total')} className="px-3 py-2 text-right cursor-pointer hover:text-white">
                      Score {sortKey === 'score_total' && (asc ? '▲' : '▼')}
                    </th>
                    <th onClick={() => toggleSort('confiance')} className="px-3 py-2 text-right cursor-pointer hover:text-white">
                      Confiance {sortKey === 'confiance' && (asc ? '▲' : '▼')}
                    </th>
                    <th className="px-3 py-2 text-right">Cours</th>
                    <th className="px-3 py-2 text-center w-16">Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((s) => (
                    <TableRow key={s.code} s={s} onDetail={() => openModal(s)} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 p-3 border-t border-border/50">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 text-xs rounded transition ${
                      p === page ? 'bg-up/20 text-up border border-up/40' : 'text-muted hover:text-white border border-transparent'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                {page < totalPages && (
                  <button
                    type="button"
                    onClick={() => setPage(page + 1)}
                    className="text-xs text-muted hover:text-white px-2"
                  >
                    Suivant →
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal ── */}
      {modal && <SignalDetailModal signal={modal} onClose={() => setModal(null)} />}
    </>
  );
}

// ─── Ligne de tableau ──────────────────────────────────────────────────────
function TableRow({ s, onDetail }: { s: SignalRow; onDetail: () => void }) {
  const up  = (s.variation_pct ?? 0) >= 0;
  const conf = s.confiance ?? 0;
  const scoreUp = (s.score_total ?? 0) >= 0;

  return (
    <tr
      className={`border-b border-border/40 hover:bg-bg/50 transition-colors group ${
        s.signal === 'BUY' ? 'bg-emerald-500/[0.06] border-l-2 border-l-emerald-500' : ''
      }`}
    >
      {/* Signal */}
      <td className="px-3 py-2 text-center">
        <span className="inline-flex items-center gap-1.5">
          <SignalBadge signal={s.signal} small />
          <RatingBadge scoreTotal={s.score_total} confiance={s.confiance} />
        </span>
      </td>

      {/* Instrument */}
      <td className="px-3 py-2">
        <Link href={`/actions/${s.code}`} className="flex items-center gap-2 hover:text-up group-hover:text-up">
          {LOGOS[s.code] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={LOGOS[s.code]} alt={s.code} width={24} height={24} className="w-6 h-6 rounded object-contain shrink-0 bg-white p-px" />
          ) : (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded text-[9px] font-bold shrink-0 bg-border text-faint">{s.code.slice(0, 2)}</span>
          )}
          <span className="font-medium">{s.code}</span>
        </Link>
        {s.designation && (
          <div className="text-xs text-muted truncate max-w-[180px] ml-8">{s.designation}</div>
        )}
        {s.secteur && (
          <div className="text-[10px] text-faint ml-8">{s.secteur}</div>
        )}
      </td>

      {/* Score avec barre */}
      <td className="px-3 py-2 text-right">
        <span className={`tabular text-sm font-mono font-medium ${scoreUp ? 'text-up' : 'text-down'}`}>
          {s.score_total != null ? (scoreUp ? '+' : '') + s.score_total.toFixed(2) : '—'}
        </span>
        {s.score_total != null && (
          <div className="w-16 ml-auto mt-0.5 h-1 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${scoreUp ? 'bg-up' : 'bg-down'}`}
              style={{ width: `${Math.min(100, Math.abs(s.score_total) * 100)}%` }}
            />
          </div>
        )}
      </td>

      {/* Confiance avec mini barre */}
      <td className="px-3 py-2 text-right">
        <span className="tabular text-xs">{conf > 0 ? Math.round(conf * 100) + '%' : '—'}</span>
        {conf > 0 && (
          <div className="w-12 ml-auto mt-0.5 h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-muted/60 rounded-full"
              style={{ width: `${conf * 100}%` }}
            />
          </div>
        )}
      </td>

      {/* Cours */}
      <td className={`px-3 py-2 text-right tabular text-sm ${up ? 'text-up' : 'text-down'}`}>
        {fmtNumber(s.cours_jour)}
        {s.variation_pct != null && (
          <div className="text-[10px]">
            {up ? '+' : ''}{s.variation_pct.toFixed(2)}%
          </div>
        )}
      </td>

      {/* Action */}
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          onClick={onDetail}
          title="Voir le détail du signal"
          className="text-sm text-muted group-hover:text-up hover:scale-110 transition"
        >
          →
        </button>
      </td>
    </tr>
  );
}

// ─── Modal détail ──────────────────────────────────────────────────────────
function SignalDetailModal({ signal: s, onClose }: { signal: SignalRow; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const inputsJson = (s as SignalRow & { inputs?: Record<string, unknown> }).inputs;
  const jsonStr = inputsJson ? JSON.stringify(inputsJson, null, 2) : null;

  const subScores: { label: string; key: keyof SignalRow; neg?: boolean }[] = [
    { label: 'variation_norm', key: 'score_variation' },
    { label: 'volume_signal',  key: 'score_volume' },
    { label: 'rsi_signal',     key: 'score_rsi' },
    { label: 'bonus_tendance', key: 'bonus_tendance' },
    { label: 'penalite_liquidite', key: 'penalite_liquidite', neg: true },
  ];

  const maxAbs = Math.max(
    ...subScores
      .map(({ key }) => Math.abs((s[key] as number | null | undefined) ?? 0))
      .filter(Boolean),
    0.01,
  );

  async function copyJson() {
    if (!jsonStr) return;
    await navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-semibold">🔍 Détail du signal — {s.code}</h2>
            <p className="text-xs text-muted mt-0.5">
              {s.date_marche} • Score : <span className={`tabular font-mono font-medium ${(s.score_total ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
                {s.score_total != null ? ((s.score_total >= 0 ? '+' : '') + s.score_total.toFixed(2)) : '—'}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SignalBadge signal={s.signal} confiance={s.confiance} />
            <button type="button" onClick={onClose} className="text-muted hover:text-white text-xl leading-none ml-2">✕</button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Composantes du score */}
          <div>
            <h3 className="text-sm font-semibold mb-3">📊 Composantes du score</h3>
            <div className="space-y-2">
              {subScores.map(({ label, key, neg }) => {
                const raw = (s[key] as number | null | undefined) ?? null;
                if (raw == null) return null;
                const val = neg ? -Math.abs(raw) : raw;
                const pct = (Math.abs(raw) / maxAbs) * 100;
                const positive = val >= 0;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted w-40 shrink-0">{label}</span>
                    <span className={`tabular text-xs font-mono w-12 text-right ${positive ? 'text-up' : 'text-down'}`}>
                      {val >= 0 ? '+' : ''}{val.toFixed(2)}
                    </span>
                    <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${positive ? 'bg-up' : 'bg-down'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Explication */}
          <div>
            <h3 className="text-sm font-semibold mb-2">📝 Explication générée</h3>
            <div className="bg-bg border border-border/60 rounded-lg p-3">
              <p className="text-sm text-muted leading-relaxed">
                {s.explication ?? 'Aucune explication enregistrée pour ce signal.'}
              </p>
            </div>
          </div>

          {/* Inputs bruts */}
          {jsonStr && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">📥 Inputs bruts (audit)</h3>
                <button
                  type="button"
                  onClick={copyJson}
                  className="text-xs text-muted hover:text-up border border-border rounded px-2 py-0.5 transition"
                >
                  {copied ? '✓ Copié !' : '📋 Copier'}
                </button>
              </div>
              <pre className="bg-bg border border-border/60 rounded-lg p-3 text-xs font-mono text-muted overflow-x-auto max-h-48">
                {jsonStr}
              </pre>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex gap-2 pt-2 border-t border-border/50">
            {jsonStr && (
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([jsonStr], { type: 'application/json' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `signal-${s.code}-${s.date_marche}.json`;
                  a.click();
                }}
                className="text-xs border border-border rounded px-3 py-1.5 text-muted hover:text-up hover:border-up/40 transition"
              >
                📥 Exporter JSON
              </button>
            )}
            <Link
              href={`/actions/${s.code}`}
              className="text-xs border border-border rounded px-3 py-1.5 text-muted hover:text-up hover:border-up/40 transition"
              onClick={onClose}
            >
              Voir la fiche →
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="text-xs ml-auto border border-border rounded px-3 py-1.5 text-muted hover:text-white transition"
            >
              ✕ Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
