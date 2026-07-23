'use client';

import { useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  SERIES_CATALOG, DEFAULT_SELECTION, planAxes, peutAjouter,
  type ChartRow, type UnitClass,
} from '@/lib/financials/chartBuilder';

/**
 * Constructeur de graphique : l'utilisateur coche les séries, les axes se
 * placent seuls (montants / % / par-action — 2 classes d'unité max, cf.
 * lib/financials/chartBuilder.ts). Composant de rendu pur : toutes les valeurs
 * viennent de buildChartRows, rien n'est calculé ici.
 */

const PALETTE = ['#56D7FD', '#3fe18b', '#e8b54d', '#7e57c2', '#ff6b6b', '#e6e9f0', '#26a69a', '#f06292'];
const AXIS = '#7a9ea8';
const GRID = '#1a2a30';

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

export default function ChartBuilder({ rows }: { rows: ChartRow[] }) {
  const [selection, setSelection] = useState<string[]>(DEFAULT_SELECTION);

  const plan = useMemo(() => planAxes(selection), [selection]);
  const defs = useMemo(() => new Map<string, (typeof SERIES_CATALOG)[number]>(SERIES_CATALOG.map((s) => [s.id, s])), []);

  // Ne proposer que les séries ayant au moins un point non nul : cocher une
  // série vide produirait un graphique muet sans explication.
  const disponibles = useMemo(
    () => new Set<string>(SERIES_CATALOG.filter((s) => rows.some((r) => r[s.id] != null)).map((s) => s.id)),
    [rows],
  );

  const basculer = (id: string) => {
    setSelection((sel) =>
      sel.includes(id) ? sel.filter((x) => x !== id) : peutAjouter(sel, id) ? [...sel, id] : sel,
    );
  };

  const actives = selection.filter((id) => disponibles.has(id));
  if (rows.length < 2) return null; // une seule année : rien à tracer

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <div>
        <p className="text-xs text-muted">Construire un graphique</p>
        <p className="text-[10px] text-faint">
          Cochez jusqu’à deux familles d’unités (montants, %, FCFA/action) — les axes se placent seuls.
          Une case grisée ajouterait une troisième unité : décochez d’abord.
        </p>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {GROUPES.map((g) => {
          const series = SERIES_CATALOG.filter((s) => s.groupe === g && disponibles.has(s.id));
          if (series.length === 0) return null;
          return (
            <fieldset key={g} className="min-w-[10rem]">
              <legend className="text-[10px] uppercase tracking-wider text-faint mb-1">{g}</legend>
              <div className="flex flex-wrap gap-1.5">
                {series.map((s) => {
                  const coche = selection.includes(s.id);
                  const bloque = !coche && !peutAjouter(selection, s.id);
                  return (
                    <button
                      key={s.id} type="button" onClick={() => basculer(s.id)} disabled={bloque}
                      aria-pressed={coche}
                      title={bloque ? 'Ajouterait une 3e famille d’unités — décochez d’abord une série.' : undefined}
                      className={`px-2 py-1 rounded border text-[11px] transition ${
                        coche
                          ? 'border-accent/60 bg-accent/10 text-accent'
                          : bloque
                            ? 'border-border text-faint cursor-not-allowed opacity-50'
                            : 'border-border text-muted hover:border-accent/40 hover:text-white'
                      }`}
                    >
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
        <p className="py-10 text-center text-sm text-muted">Sélectionnez au moins une série.</p>
      ) : (
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <XAxis dataKey="periode" tick={{ fill: AXIS, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} />
              <YAxis yAxisId="g" tick={{ fill: AXIS, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false}
                tickFormatter={fmtAxe(plan.gauche)} width={58} />
              {plan.droite && (
                <YAxis yAxisId="d" orientation="right" tick={{ fill: AXIS, fontSize: 11 }}
                  axisLine={{ stroke: GRID }} tickLine={false} tickFormatter={fmtAxe(plan.droite)} width={52} />
              )}
              <Tooltip
                contentStyle={{ background: '#0a1417', border: `1px solid ${GRID}`, borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e5e7eb' }}
                formatter={(v: number, name: string) => {
                  const def = SERIES_CATALOG.find((s) => s.label === name);
                  return [def ? fmtVal(def.unit)(v) : nf.format(v), name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {actives.map((id, i) => {
                const def = defs.get(id);
                if (!def) return null;
                const axe = def.unit === plan.gauche ? 'g' : 'd';
                const couleur = PALETTE[i % PALETTE.length];
                return def.render === 'bar' ? (
                  <Bar key={id} yAxisId={axe} dataKey={id} name={def.label} fill={couleur}
                    radius={[3, 3, 0, 0]} maxBarSize={26} />
                ) : (
                  <Line key={id} yAxisId={axe} dataKey={id} name={def.label} stroke={couleur}
                    strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-[10px] text-faint">
        Séries dérivées des états financiers publiés (une valeur manquante laisse un trou — rien n’est estimé).
        Marges = résultat / CA ; ROE = résultat net / capitaux propres.
      </p>
    </div>
  );
}
