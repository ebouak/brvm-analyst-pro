'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { RotateCcw } from 'lucide-react';
import {
  SERIES_CATALOG, DEFAULT_SELECTION, planAxes, peutAjouter, normalizeRows,
  type ChartRow, type UnitClass,
} from '@/lib/financials/chartBuilder';
import { chartTheme } from '@/lib/chartTheme';

/**
 * Constructeur de graphique fondamental : l'utilisateur coche les séries,
 * les axes se placent seuls (montants / % / par-action — 2 classes d'unité max).
 * Style aligné sur la landing page (jetons CSS clair/sombre via chartTheme()).
 */

const nf = new Intl.NumberFormat('fr-FR');
const fmtAxe = (unit: UnitClass | null) => (v: number) => {
  if (unit === 'fcfa') return `${nf.format(Math.round(v / 1e9))} Md`;
  if (unit === 'pct') return `${nf.format(Math.round(v))} %`;
  return nf.format(Math.round(v));
};
const fmtVal = (unit: UnitClass) => (v: number) => {
  if (unit === 'fcfa') return `${nf.format(Math.round(v / 1e6) / 1e3)} Md FCFA`;
  if (unit === 'pct') return `${nf.format(Math.round(v * 100) / 100)} %`;
  return `${nf.format(Math.round(v * 100) / 100)} FCFA`;
};

const GROUPES = ['Compte de résultat', 'Bilan', 'Flux de trésorerie', 'Par action', 'Ratios'] as const;

interface Preset {
  id: string;
  label: string;
  series: string[];
}

const PRESETS: Preset[] = [
  { id: 'perf', label: 'Performance', series: ['revenu', 'rn', 'margeNette'] },
  { id: 'rentabilite', label: 'Rentabilité (ROE / ROA)', series: ['capitauxPropres', 'rn', 'roe', 'roa'] },
  { id: 'bilan', label: 'Bilan & Trésorerie', series: ['totalActif', 'tresorerie', 'dettesFin', 'levierDetteCp'] },
  { id: 'cash', label: 'Cash-Flow & FCF', series: ['fluxExploitation', 'capex', 'fcf', 'margeFcf'] },
  { id: 'action', label: 'Par action', series: ['bpa', 'dividende'] },
];

interface TooltipItem {
  name?: string;
  value?: number;
  color?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  indice,
  catalogue,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
  indice: boolean;
  catalogue: typeof SERIES_CATALOG;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border-strong bg-surface/95 px-3.5 py-2.5 shadow-card backdrop-blur-sm">
      <p className="mb-1.5 border-b border-border/70 pb-1 font-mono text-[11px] font-medium text-ivory">
        Exercice {label}
      </p>
      <ul className="space-y-1">
        {payload.map((entry) => {
          const name = entry.name ?? '';
          const val = typeof entry.value === 'number' ? entry.value : null;
          const def = catalogue.find((s) => s.label === name);
          const formatted =
            val == null
              ? '—'
              : indice
                ? `${nf.format(Math.round(val * 10) / 10)} (base 100)`
                : def
                  ? fmtVal(def.unit)(val)
                  : nf.format(val);
          return (
            <li key={name} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                {name}
              </span>
              <span className="tabular font-medium text-ivory">{formatted}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ChartBuilder({
  rows,
  banque = false,
}: {
  rows: ChartRow[];
  /** Banque : le revenu est un produit net bancaire, pas un chiffre d'affaires. */
  banque?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const [theme, setTheme] = useState(() => chartTheme());

  useEffect(() => {
    const refresh = () => setTheme(chartTheme());
    refresh();
    const obs = new MutationObserver(refresh);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => obs.disconnect();
  }, []);

  const palette = useMemo(
    () => [theme.accent, theme.up, theme.warn, '#8b6fc2', theme.down, theme.ivory, '#26a69a', '#d97706'],
    [theme],
  );

  // Même catalogue, adapté au vocabulaire bancaire si nécessaire.
  const catalogue = useMemo(
    () =>
      SERIES_CATALOG
        .filter((s) => banque || !s.banqueUniquement)
        .map((s) => {
          if (!banque) return s;
          if (s.id === 'revenu') return { ...s, label: 'Produit net bancaire' };
          if (s.id === 'croissanceCa') return { ...s, label: 'Croissance PNB %' };
          return s;
        }),
    [banque],
  );

  const [selection, setSelection] = useState<string[]>(DEFAULT_SELECTION);
  const [indice, setIndice] = useState(false);

  const plan = useMemo(() => planAxes(selection), [selection]);
  const defs = useMemo(() => new Map<string, (typeof SERIES_CATALOG)[number]>(catalogue.map((s) => [s.id, s])), [catalogue]);

  const disponibles = useMemo(
    () => new Set<string>(catalogue.filter((s) => rows.some((r) => r[s.id] != null)).map((s) => s.id)),
    [rows, catalogue],
  );

  const basculer = (id: string) => {
    setSelection((sel) =>
      sel.includes(id) ? sel.filter((x) => x !== id) : (indice || peutAjouter(sel, id)) ? [...sel, id] : sel,
    );
  };

  const actives = selection.filter((id) => disponibles.has(id));
  const data = useMemo(() => (indice ? normalizeRows(rows, actives) : rows), [indice, rows, actives]);
  const estDefaut =
    !indice &&
    selection.length === DEFAULT_SELECTION.length &&
    DEFAULT_SELECTION.every((id) => selection.includes(id));

  if (rows.length < 2) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="font-display text-base font-semibold tracking-tight text-ivory">
            Construire un graphique
          </h3>
          <p className="text-xs text-muted">
            {indice
              ? 'Mode base 100 : toutes les séries sont ramenées à 100 la première année.'
              : 'Sélectionnez jusqu’à deux familles d’unités (montants, %, FCFA/action) ou activez « Base 100 ».'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!estDefaut && (
            <button
              type="button"
              onClick={() => { setSelection(DEFAULT_SELECTION); setIndice(false); }}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted transition hover:border-border-strong hover:text-ivory"
            >
              <RotateCcw className="h-3 w-3" />
              Réinitialiser
            </button>
          )}
          <button
            type="button"
            onClick={() => setIndice((v) => !v)}
            aria-pressed={indice}
            className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition ${
              indice
                ? 'border-accent bg-accent/15 text-accent-ink'
                : 'border-border bg-sunken/50 text-muted hover:border-border-strong hover:text-ivory'
            }`}
            title="Ramène chaque série à 100 la première année pour comparer les évolutions, quelles que soient les unités."
          >
            Base 100
          </button>
        </div>
      </div>

      {/* Préréglages rapides */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/70 pb-3">
        <span className="mr-1 text-[11px] font-medium text-faint">Vues rapides :</span>
        {PRESETS.map((p) => {
          const applicable = p.series.filter((id) => disponibles.has(id));
          if (applicable.length === 0) return null;
          const actif =
            applicable.length === actives.length && applicable.every((id) => actives.includes(id));
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => { setIndice(false); setSelection(applicable); }}
              className={`rounded-full px-2.5 py-0.5 text-[11px] transition ${
                actif
                  ? 'bg-ivory text-bg font-medium'
                  : 'bg-sunken text-muted hover:bg-border/60 hover:text-ivory'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Sélecteur par famille */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {GROUPES.map((g) => {
          const series = catalogue.filter((s) => s.groupe === g && disponibles.has(s.id));
          if (series.length === 0) return null;
          return (
            <fieldset key={g} className="space-y-1.5">
              <legend className="text-[11px] font-medium text-faint">{g}</legend>
              <div className="flex flex-wrap gap-1.5">
                {series.map((s) => {
                  const idx = actives.indexOf(s.id);
                  const coche = idx !== -1;
                  const bloque = !coche && !indice && !peutAjouter(selection, s.id);
                  const couleur = coche ? palette[idx % palette.length] : undefined;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => basculer(s.id)}
                      disabled={bloque}
                      aria-pressed={coche}
                      title={bloque ? 'Ajouterait une 3e famille d’unités : décochez d’abord une série.' : undefined}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition ${
                        coche
                          ? 'border-accent/50 bg-accent/10 font-medium text-ivory'
                          : bloque
                            ? 'cursor-not-allowed border-border/50 text-faint opacity-45'
                            : 'border-border bg-sunken/30 text-muted hover:border-border-strong hover:text-ivory'
                      }`}
                    >
                      {coche && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: couleur }} />
                      )}
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      {actives.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">Sélectionnez au moins une série à tracer.</p>
      ) : (
        <div className="rounded-xl border border-border/70 bg-sunken/25 px-2 pt-3 pb-1" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 2, left: 6 }}>
              <defs>
                {actives.map((id, i) => {
                  const c = palette[i % palette.length];
                  return (
                    <linearGradient key={id} id={`cb-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity={0.92} />
                      <stop offset="100%" stopColor={c} stopOpacity={0.68} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.border} opacity={0.75} />
              <XAxis
                dataKey="periode"
                tick={{ fill: theme.muted, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                axisLine={{ stroke: theme.border }}
                tickLine={false}
              />
              <YAxis
                yAxisId="g"
                tick={{ fill: theme.muted, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={indice ? (v: number) => nf.format(Math.round(v)) : fmtAxe(plan.gauche)}
                width={indice ? 44 : 58}
              />
              {!indice && plan.droite && (
                <YAxis
                  yAxisId="d"
                  orientation="right"
                  tick={{ fill: theme.muted, fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtAxe(plan.droite)}
                  width={52}
                />
              )}
              <Tooltip
                cursor={{ fill: theme.border, opacity: 0.2 }}
                content={<CustomTooltip indice={indice} catalogue={catalogue} />}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} iconType="circle" iconSize={8} />
              {actives.map((id, i) => {
                const def = defs.get(id);
                if (!def) return null;
                const axe = indice || def.unit === plan.gauche ? 'g' : 'd';
                const couleur = palette[i % palette.length];
                return !indice && def.render === 'bar' ? (
                  <Bar
                    key={id}
                    yAxisId={axe}
                    dataKey={id}
                    name={def.label}
                    fill={`url(#cb-${uid}-${i})`}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                ) : (
                  <Line
                    key={id}
                    type="monotone"
                    yAxisId={axe}
                    dataKey={id}
                    name={def.label}
                    stroke={couleur}
                    strokeWidth={2.25}
                    dot={{ r: 3.5, fill: theme.surface, stroke: couleur, strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: couleur, stroke: theme.surface, strokeWidth: 2 }}
                    connectNulls={false}
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-faint">
        Séries dérivées des états financiers publiés (une valeur manquante laisse un trou, rien n’est estimé).
        Marges = résultat / {banque ? 'PNB' : 'CA'} · ROE = RN / capitaux propres · ROA = RN / total actif · FCF = flux d’exploitation − |Capex|.
      </p>
    </div>
  );
}
