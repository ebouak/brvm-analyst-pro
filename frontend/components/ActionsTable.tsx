'use client';
import { ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ActionDaily, SignalDaily } from '@/lib/types';
import { fmtNumber, fmtFcfa, fmtPctSigne } from '@/lib/format';
import SignalBadge from './SignalBadge';
import Sparkline from './Sparkline';
import ExportButton from './ExportButton';
import type { CsvColumn } from '@/lib/export';
import brvmLogos from '@/lib/brvmLogos.json';

const LOGOS = brvmLogos as Record<string, string>;

type SortKey = 'code' | 'secteur' | 'variation_pct' | 'cours_jour' | 'volume' | 'valeur_echangee';
const STRING_KEYS = new Set<SortKey>(['code', 'secteur']);

/** Tri proposé sur mobile, où les en-têtes de colonnes n'existent pas. */
const SORT_OPTIONS: { value: string; label: string; key: SortKey; asc: boolean }[] = [
  { value: 'variation_pct:desc', label: 'Plus fortes hausses', key: 'variation_pct', asc: false },
  { value: 'variation_pct:asc', label: 'Plus fortes baisses', key: 'variation_pct', asc: true },
  { value: 'volume:desc', label: 'Volume décroissant', key: 'volume', asc: false },
  { value: 'valeur_echangee:desc', label: 'Valeur échangée décroissante', key: 'valeur_echangee', asc: false },
  { value: 'cours_jour:desc', label: 'Cours décroissant', key: 'cours_jour', asc: false },
  { value: 'cours_jour:asc', label: 'Cours croissant', key: 'cours_jour', asc: true },
  { value: 'code:asc', label: 'Code (A → Z)', key: 'code', asc: true },
  { value: 'secteur:asc', label: 'Secteur (A → Z)', key: 'secteur', asc: true },
];

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

const EASE = 'transition-colors duration-150 ease-out';
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60';

/**
 * Teinte d'une variation. Absente → « — » en faint, jamais un « +0,00 % » vert :
 * un chiffre affiché pour une donnée manquante serait un chiffre inventé.
 * Nulle (après arrondi, comme fmtPctSigne) → neutre.
 */
function tonVariation(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return 'text-faint';
  const r = Number(v.toFixed(2));
  return r > 0 ? 'text-up' : r < 0 ? 'text-down' : 'text-muted';
}

function Variation({ v }: { v: number | null | undefined }) {
  return <>{v == null ? '—' : fmtPctSigne(v)}</>;
}

/* ── Input/Select atoms ──────────────────────────────────────────────────── */
// Mobile : 44 px de haut (cible tactile) et 16 px de police (sinon iOS zoome
// au focus). À partir de md, on revient au gabarit compact d'origine.
const fieldCls =
  `bg-bg border border-border rounded-lg px-3 py-1.5 min-h-[44px] md:min-h-0 text-base md:text-sm text-ivory
   focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 ${EASE}`;
const inputCls = `${fieldCls} placeholder:text-faint`;
const selectCls = fieldCls;

/**
 * Cellule verrouillée : le calcul existe, l'utilisateur n'y a pas droit.
 * On ne floute PAS une vraie valeur — l'appelant ne la transmet même pas.
 */
function LockedCell() {
  return (
    <Link
      href="/account/plan"
      title="Réservé aux abonnés. Voir les formules"
      className={`inline-flex items-center gap-1 rounded text-xs text-faint hover:text-accent-ink ${FOCUS} ${EASE}`}
    >
      <Lock size={12} strokeWidth={1.75} aria-hidden />
      Premium
    </Link>
  );
}

function Logo({ code, size }: { code: string; size: 'sm' | 'md' }) {
  const box = size === 'md' ? 'w-9 h-9' : 'w-7 h-7';
  const px = size === 'md' ? 36 : 28;
  return LOGOS[code] ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGOS[code]}
      alt=""
      width={px}
      height={px}
      className={`${box} rounded-md object-contain shrink-0 bg-white/10 p-0.5 border border-border/60`}
    />
  ) : (
    <span
      aria-hidden
      className={`tabular inline-flex items-center justify-center ${box} rounded-md text-[11px] font-medium shrink-0 bg-elevated text-muted border border-border/60`}
    >
      {code.slice(0, 2)}
    </span>
  );
}

export default function ActionsTable({
  actions,
  signals,
  sparklines = {},
  initialSecteur = '',
  showMetrics = true,
}: {
  actions: ActionDaily[];
  signals: Record<string, SignalDaily>;
  sparklines?: Record<string, number[]>;
  initialSecteur?: string;
  /**
   * Colonnes CALCULÉES (Tendance 30 j, Signal). Pilotées par `feature_flags`
   * (`actions_metrics`) : quand elles sont refusées, l'appelant ne transmet même
   * pas les données — les colonnes affichent un cadenas, pas une valeur floutée.
   * Les cours bruts (cours, variation, volume) restent publics.
   */
  showMetrics?: boolean;
}) {
  const [q, setQ] = useState('');
  const [pays, setPays] = useState('');
  const [secteur, setSecteur] = useState(initialSecteur);
  const [minVol, setMinVol] = useState(0);
  const [perf, setPerf] = useState<'all' | 'up' | 'down'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('variation_pct');
  const [asc, setAsc] = useState(false);
  // Mobile : le bloc pays/secteur/perf/volume est replié par défaut.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();

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
      const av = a[sortKey];
      const bv = b[sortKey];
      // Valeur absente : toujours en fin de liste, dans les deux sens. Comptée
      // comme 0, elle se glissait au milieu des variations et des volumes.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = STRING_KEYS.has(sortKey)
        ? String(av).localeCompare(String(bv))
        : (av as number) - (bv as number);
      return asc ? cmp : -cmp;
    });
    return r;
  }, [actions, q, pays, secteur, minVol, perf, sortKey, asc]);

  /*
   * Colonne Signal : le moteur s'abstient le plus souvent (CLAUDE.md §9). Une
   * colonne entière de « — » n'informe pas ; on la masque quand AUCUNE ligne
   * affichée n'a de signal, et on le dit une fois. Sans droit (`showMetrics`
   * faux), la donnée n'est pas transmise : on garde la colonne verrouillée.
   */
  const anySignalShown = rows.some((r) => !!signals[r.code]?.signal);
  const anySignalSeance = actions.some((a) => !!signals[a.code]?.signal);
  const showSignalCol = !showMetrics || anySignalShown;
  const colCount = showSignalCol ? 8 : 7;

  const activeFilters =
    (pays ? 1 : 0) + (secteur ? 1 : 0) + (perf !== 'all' ? 1 : 0) + (minVol > 0 ? 1 : 0);

  const currentSort = `${sortKey}:${asc ? 'asc' : 'desc'}`;
  const sortIsListed = SORT_OPTIONS.some((o) => o.value === currentSort);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(false); }
  }

  /* ── Column header with sort indicator ──────────────────────────────── */
  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th
      aria-sort={sortKey === k ? (asc ? 'ascending' : 'descending') : 'none'}
      className={`px-4 py-3 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={`
          overline cursor-pointer select-none rounded ${FOCUS}
          hover:text-ivory ${EASE}
          ${sortKey === k ? 'text-ivory' : 'text-faint'}
        `}
      >
        {label}
        {sortKey === k && (asc
          ? <ChevronUp size={12} strokeWidth={1.75} aria-hidden className="ml-0.5 inline-block align-[-1px]" />
          : <ChevronDown size={12} strokeWidth={1.75} aria-hidden className="ml-0.5 inline-block align-[-1px]" />)}
      </button>
    </th>
  );

  const noSignalNote = showMetrics && !anySignalShown && rows.length > 0 && (
    <p className="px-4 py-2 border-b border-border/60 text-xs text-muted">
      {anySignalSeance
        ? 'Aucun signal net parmi les titres affichés. Le moteur s’abstient quand rien n’est clair.'
        : 'Aucun signal net sur cette séance. Le moteur s’abstient quand rien n’est clair.'}
    </p>
  );

  return (
    <div>
      {/* ── Barre de filtres ──────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-border/60 space-y-2 md:space-y-0 md:flex md:flex-wrap md:items-center md:gap-2">
        {/* Recherche (+ bouton Filtres sur mobile) : toujours visible */}
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Code ou nom"
            aria-label="Rechercher une valeur par code ou par nom"
            className={`${inputCls} flex-1 min-w-0 md:flex-none md:w-52`}
          />
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            onClick={() => setFiltersOpen((o) => !o)}
            className={`md:hidden shrink-0 min-h-[44px] rounded-lg border px-3 text-sm ${FOCUS} ${EASE} ${
              activeFilters > 0 ? 'border-gold/40 text-gold' : 'border-border text-muted'
            }`}
          >
            Filtres{activeFilters > 0 && <span className="tabular">{` (${activeFilters})`}</span>}
            <ChevronDown
              size={14}
              strokeWidth={1.75}
              aria-hidden
              className={`ml-1 inline-block align-[-2px] transition-transform duration-150 ${filtersOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Pays / secteur / perf / volume : repliés sur mobile, toujours visibles dès md */}
        <div
          id={filtersId}
          className={`${filtersOpen ? 'grid' : 'hidden'} grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center`}
        >
          <select value={pays} onChange={(e) => setPays(e.target.value)} aria-label="Pays" className={selectCls}>
            <option value="">Tous pays</option>
            {paysOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={secteur} onChange={(e) => setSecteur(e.target.value)} aria-label="Secteur" className={selectCls}>
            <option value="">Tous secteurs</option>
            {secteurOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={perf}
            onChange={(e) => setPerf(e.target.value as 'all' | 'up' | 'down')}
            aria-label="Variation"
            className={selectCls}
          >
            <option value="all">Toutes variations</option>
            <option value="up">Hausses</option>
            <option value="down">Baisses</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-muted">
            <span className="shrink-0">Volume min.</span>
            <input
              type="number"
              inputMode="numeric"
              value={minVol}
              onChange={(e) => setMinVol(Number(e.target.value) || 0)}
              className={`${inputCls} w-full md:w-24 tabular`}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:ml-auto md:flex-nowrap">
          {/* Tri mobile : les en-têtes de colonnes n'existent pas sous md.
              Sur sa propre ligne : partagée avec le compteur et l'export, la
              liste était tronquée (« Plus fo… »). */}
          <select
            value={sortIsListed ? currentSort : ''}
            onChange={(e) => {
              const o = SORT_OPTIONS.find((x) => x.value === e.target.value);
              if (o) { setSortKey(o.key); setAsc(o.asc); }
            }}
            aria-label="Trier les valeurs"
            className={`${selectCls} md:hidden w-full basis-full`}
          >
            {!sortIsListed && <option value="">Tri personnalisé</option>}
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span className="text-xs text-faint tabular shrink-0">
            <span className="text-ivory font-medium">{rows.length}</span> résultats
          </span>
          {/* ExportButton — wrapper for premium look */}
          <div className={`shrink-0 [&>button]:rounded-lg [&>button]:border-border-strong [&>button]:text-muted [&>button]:px-3 [&>button]:py-1.5 [&>button]:text-xs [&>button]:hover:border-gold/30 [&>button]:hover:text-accent-ink ${EASE}`}>
            <ExportButton<ActionDaily>
              filename={`actions_${new Date().toISOString().slice(0, 10)}.csv`}
              rows={rows}
              columns={CSV_COLUMNS}
            />
          </div>
        </div>
      </div>

      {noSignalNote}

      {/* ── Mobile (< md) : une carte par valeur ──────────────────────────── */}
      <ul className="md:hidden divide-y divide-border/40" aria-label="Valeurs cotées">
        {rows.length === 0 && (
          <li className="px-4 py-12 text-center text-muted text-sm">
            Aucun titre ne correspond à ces filtres.
          </li>
        )}
        {rows.map((a) => {
          const sig = showMetrics ? signals[a.code] : undefined;
          return (
            <li key={a.code}>
              <Link
                href={`/actions/${a.code}`}
                className={`flex items-center gap-3 px-4 py-3 min-h-[56px] hover:bg-white/[0.02] ${FOCUS} focus-visible:ring-inset ${EASE}`}
              >
                <Logo code={a.code} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="tabular font-medium text-ivory">{a.code}</span>
                    {sig?.signal && <SignalBadge signal={sig.signal} confiance={sig.confiance} small />}
                  </div>
                  <div className="text-xs text-faint truncate leading-tight">{a.designation}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="tabular text-ivory font-medium">{fmtNumber(a.cours_jour)}</div>
                  <div className={`tabular text-sm font-medium ${tonVariation(a.variation_pct)}`}>
                    <Variation v={a.variation_pct} />
                  </div>
                  <div className="tabular text-xs text-muted">
                    Vol. {fmtNumber(a.volume)}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* ── Tableau (≥ md) ────────────────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 bg-bg/60">
            <tr>
              <Th k="code" label="Titre" />
              <Th k="secteur" label="Secteur" />
              <Th k="cours_jour" label="Cours" right />
              <Th k="variation_pct" label="Var %" right />
              <th className="overline px-4 py-3 text-center text-faint whitespace-nowrap">
                Tendance 30j {!showMetrics && <span aria-label="Premium" title="Premium"><Lock size={11} strokeWidth={2} className="inline-block align-[-1px]" aria-hidden /></span>}
              </th>
              <Th k="volume" label="Volume" right />
              <Th k="valeur_echangee" label="Valeur" right />
              {showSignalCol && (
                <th className="overline px-4 py-3 text-center text-faint whitespace-nowrap">
                  Signal {!showMetrics && <span aria-label="Premium" title="Premium"><Lock size={11} strokeWidth={2} className="inline-block align-[-1px]" aria-hidden /></span>}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-16 text-center text-muted text-sm">
                  Aucun titre ne correspond à ces filtres.
                </td>
              </tr>
            )}
            {rows.map((a) => {
              const sig = signals[a.code];
              // Couleur de la tendance tirée de la série elle-même (dernier cours
              // contre premier de la fenêtre), pas de la variation du jour : une
              // séance en hausse ne fait pas une tendance 30 j haussière.
              const serie = sparklines[a.code];
              const serieMonte = serie && serie.length >= 2 ? serie[serie.length - 1]! >= serie[0]! : true;
              return (
                <tr
                  key={a.code}
                  className={`border-b border-border/40 hover:bg-white/[0.02] ${EASE} group`}
                >
                  {/* ── Code + Désignation ─────────────────────────────── */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/actions/${a.code}`}
                      className={`flex items-center gap-2.5 rounded ${FOCUS}`}
                    >
                      <Logo code={a.code} size="sm" />
                      <div>
                        <span className={`tabular font-medium text-ivory group-hover:text-accent-ink ${EASE}`}>{a.code}</span>
                        <div className="text-[11px] text-faint truncate max-w-[160px] leading-tight">
                          {a.designation}
                        </div>
                      </div>
                    </Link>
                  </td>

                  {/* ── Secteur ───────────────────────────────────────── */}
                  <td className="px-4 py-3">
                    {a.secteur ? (
                      <span title={a.secteur} className="block max-w-[18ch] truncate whitespace-nowrap text-xs text-muted">
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
                  <td className={`px-4 py-3 text-right tabular font-medium whitespace-nowrap ${tonVariation(a.variation_pct)}`}>
                    <Variation v={a.variation_pct} />
                  </td>

                  {/* ── Tendance 30j (sparkline) — métrique calculée ──── */}
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      {!showMetrics ? (
                        <LockedCell />
                      ) : serie && serie.length >= 2 ? (
                        <Sparkline data={serie} up={serieMonte} width={72} height={24} />
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

                  {/* ── Signal — métrique calculée ────────────────────── */}
                  {showSignalCol && (
                    <td className="px-4 py-3 text-center">
                      {showMetrics ? (
                        <SignalBadge signal={sig?.signal} confiance={sig?.confiance} small />
                      ) : (
                        <LockedCell />
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
