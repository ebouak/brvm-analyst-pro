'use client';

import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';

/**
 * Analyse graphique des fondamentaux : évolution pluriannuelle du revenu et du
 * résultat, du BPA vs dividende, et — pour les banques — des crédits vs dépôts.
 * Données déjà chargées côté serveur ; ce composant ne fait que visualiser.
 */

export interface FundaChartPoint {
  periode: string;
  revenu: number | null;        // CA / PNB / primes, en FCFA
  net: number | null;           // résultat net, en FCFA
  bpa: number | null;           // FCFA / action
  dividende: number | null;     // FCFA / action
  credits?: number | null;      // banques : crédits clientèle, FCFA
  depots?: number | null;       // banques : dépôts clientèle, FCFA
}

const ACCENT = '#56D7FD';
const UP = '#3fe18b';
const DOWN = '#ff6b6b';
const GOLD = '#e8b54d';
const AXIS = '#7a9ea8';
const GRID = '#1a2a30';

const nf = new Intl.NumberFormat('fr-FR');
const md = (v: number) => `${nf.format(Math.round(v / 1e9 * 10) / 10)} Md`;
const fcfa = (v: number) => `${nf.format(Math.round(v))} FCFA`;

const tooltipStyle = {
  contentStyle: { background: '#0a1417', border: `1px solid ${GRID}`, borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#e5e7eb' },
} as const;

function Panel({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <p className="text-xs text-muted mb-1">{title}</p>
      {hint && <p className="text-[10px] text-faint mb-2">{hint}</p>}
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function FundamentalsCharts({
  points,
  revenuLabel = 'CA',
  isBank = false,
}: {
  points: FundaChartPoint[];
  revenuLabel?: string;
  isBank?: boolean;
}) {
  // Chronologique (les tableaux arrivent en ordre décroissant).
  const data = [...points].sort((a, b) => a.periode.localeCompare(b.periode));
  if (data.length < 2) return null; // une seule année = pas de tendance à tracer

  const hasResultat = data.some((d) => d.revenu != null || d.net != null);
  const hasParAction = data.some((d) => d.bpa != null || d.dividende != null);
  const hasBank = isBank && data.some((d) => d.credits != null || d.depots != null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Revenu + résultat net + marge nette */}
      {hasResultat && (
        <Panel title={`Évolution ${revenuLabel} & résultat net`} hint="Barres en Md FCFA · ligne = marge nette (%)">
          <ComposedChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
            <XAxis dataKey="periode" tick={{ fill: AXIS, fontSize: 11 }} />
            <YAxis yAxisId="mrd" tick={{ fill: AXIS, fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1e9)}`} />
            <YAxis yAxisId="pct" orientation="right" tick={{ fill: GOLD, fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              {...tooltipStyle}
              formatter={(v: number, name: string) =>
                name === 'Marge nette' ? [`${v.toFixed(1)} %`, name] : [md(v), name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="mrd" dataKey="revenu" name={revenuLabel} fill={ACCENT} fillOpacity={0.85} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar yAxisId="mrd" dataKey="net" name="Résultat net" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={i} fill={(d.net ?? 0) >= 0 ? UP : DOWN} />
              ))}
            </Bar>
            <Line
              yAxisId="pct"
              name="Marge nette"
              dataKey={(d: FundaChartPoint) => (d.revenu && d.net != null ? (d.net / d.revenu) * 100 : null)}
              stroke={GOLD} strokeWidth={2} dot={{ r: 2 }} connectNulls isAnimationActive={false}
            />
          </ComposedChart>
        </Panel>
      )}

      {/* BPA vs dividende par action */}
      {hasParAction && (
        <Panel title="BPA & dividende par action" hint="FCFA par action · l'écart = bénéfice réinvesti">
          <ComposedChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
            <XAxis dataKey="periode" tick={{ fill: AXIS, fontSize: 11 }} />
            <YAxis tick={{ fill: AXIS, fontSize: 10 }} tickFormatter={(v) => nf.format(v)} />
            <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [fcfa(v), name]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="bpa" name="BPA" fill={ACCENT} fillOpacity={0.85} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="dividende" name="Dividende / action" fill={GOLD} fillOpacity={0.85} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </ComposedChart>
        </Panel>
      )}

      {/* Banques : crédits vs dépôts */}
      {hasBank && (
        <Panel title="Crédits & dépôts à la clientèle" hint="Md FCFA · ligne = taux de transformation (%)">
          <ComposedChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
            <XAxis dataKey="periode" tick={{ fill: AXIS, fontSize: 11 }} />
            <YAxis yAxisId="mrd" tick={{ fill: AXIS, fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1e9)}`} />
            <YAxis yAxisId="pct" orientation="right" tick={{ fill: GOLD, fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              {...tooltipStyle}
              formatter={(v: number, name: string) =>
                name === 'Transformation' ? [`${v.toFixed(0)} %`, name] : [md(v), name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="mrd" dataKey="depots" name="Dépôts" fill={UP} fillOpacity={0.8} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar yAxisId="mrd" dataKey="credits" name="Crédits" fill={ACCENT} fillOpacity={0.85} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Line
              yAxisId="pct"
              name="Transformation"
              dataKey={(d: FundaChartPoint) => (d.depots && d.credits != null ? (d.credits / d.depots) * 100 : null)}
              stroke={GOLD} strokeWidth={2} dot={{ r: 2 }} connectNulls isAnimationActive={false}
            />
          </ComposedChart>
        </Panel>
      )}
    </div>
  );
}
