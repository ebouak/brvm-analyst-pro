'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { chartTheme } from '@/lib/chartTheme';

/**
 * Analyse graphique des fondamentaux : évolution pluriannuelle du revenu et du
 * résultat, du BPA vs dividende, et — pour les banques — des crédits vs dépôts.
 * Style aligné sur la landing page (jetons CSS clair/sombre via chartTheme()).
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

const nf = new Intl.NumberFormat('fr-FR');
const md = (v: number) => `${nf.format(Math.round((v / 1e9) * 10) / 10)} Md`;
const fcfa = (v: number) => `${nf.format(Math.round(v))} FCFA`;

interface TooltipItem {
  name?: string;
  value?: number;
  color?: string;
}

function EditorialTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
  formatValue: (v: number, name: string) => string;
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
          return (
            <li key={name} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                {name}
              </span>
              <span className="tabular font-medium text-ivory">
                {val == null ? '—' : formatValue(val, name)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Panel({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-3">
      <div className="space-y-0.5">
        <h3 className="font-display text-base font-semibold tracking-tight text-ivory">{title}</h3>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <div className="rounded-xl border border-border/70 bg-sunken/25 px-2 pt-3 pb-1" style={{ height: 256 }}>
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
  sansCaRn = false,
}: {
  points: FundaChartPoint[];
  revenuLabel?: string;
  isBank?: boolean;
  /** Masque « Évolution CA & résultat net » : le constructeur de graphique le remplace. */
  sansCaRn?: boolean;
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

  const data = useMemo(
    () => [...points].sort((a, b) => a.periode.localeCompare(b.periode)),
    [points],
  );
  if (data.length < 2) return null;

  const hasResultat = !sansCaRn && data.some((d) => d.revenu != null || d.net != null);
  const hasParAction = data.some((d) => d.bpa != null || d.dividende != null);
  const bankPoints = data.filter((d) => d.credits != null || d.depots != null);
  const hasBank = isBank && bankPoints.length > 0;
  const bankData = bankPoints.length >= 2 ? bankPoints : data;

  const nbPanneaux = [hasResultat, hasParAction, hasBank].filter(Boolean).length;
  const axisTick = { fill: theme.muted, fontSize: 11, fontFamily: 'var(--font-mono)' };

  return (
    <div className={`grid grid-cols-1 gap-4 ${nbPanneaux > 1 ? 'md:grid-cols-2' : ''}`}>
      {/* Revenu + résultat net + marge nette */}
      {hasResultat && (
        <Panel title={`Évolution ${revenuLabel} & résultat net`} hint="Barres en Md FCFA · ligne = marge nette (%)">
          <ComposedChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 2 }}>
            <defs>
              <linearGradient id={`fc-rev-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.accent} stopOpacity={0.92} />
                <stop offset="100%" stopColor={theme.accent} stopOpacity={0.68} />
              </linearGradient>
              <linearGradient id={`fc-up-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.up} stopOpacity={0.92} />
                <stop offset="100%" stopColor={theme.up} stopOpacity={0.68} />
              </linearGradient>
              <linearGradient id={`fc-down-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.down} stopOpacity={0.92} />
                <stop offset="100%" stopColor={theme.down} stopOpacity={0.68} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.border} opacity={0.75} />
            <XAxis dataKey="periode" tick={axisTick} axisLine={{ stroke: theme.border }} tickLine={false} />
            <YAxis yAxisId="mrd" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1e9)}`} width={44} />
            <YAxis yAxisId="pct" orientation="right" tick={{ ...axisTick, fill: theme.warn }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v)} %`} width={44} />
            <Tooltip
              cursor={{ fill: theme.border, opacity: 0.2 }}
              content={
                <EditorialTooltip
                  formatValue={(v, name) => (name === 'Marge nette' ? `${v.toFixed(1)} %` : md(v))}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" iconSize={8} />
            <Bar yAxisId="mrd" dataKey="revenu" name={revenuLabel} fill={`url(#fc-rev-${uid})`} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            <Bar yAxisId="mrd" dataKey="net" name="Résultat net" fill={`url(#fc-up-${uid})`} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={i} fill={(d.net ?? 0) >= 0 ? `url(#fc-up-${uid})` : `url(#fc-down-${uid})`} />
              ))}
            </Bar>
            <Line
              type="monotone"
              yAxisId="pct"
              name="Marge nette"
              dataKey={(d: FundaChartPoint) => (d.revenu && d.net != null ? (d.net / d.revenu) * 100 : null)}
              stroke={theme.warn}
              strokeWidth={2.25}
              dot={{ r: 3.5, fill: theme.surface, stroke: theme.warn, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: theme.warn, stroke: theme.surface, strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </Panel>
      )}

      {/* BPA vs dividende par action */}
      {hasParAction && (
        <Panel title="BPA & dividende par action" hint="FCFA par action · l'écart = bénéfice réinvesti">
          <ComposedChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 2 }}>
            <defs>
              <linearGradient id={`fc-bpa-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.accent} stopOpacity={0.92} />
                <stop offset="100%" stopColor={theme.accent} stopOpacity={0.68} />
              </linearGradient>
              <linearGradient id={`fc-div-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.warn} stopOpacity={0.92} />
                <stop offset="100%" stopColor={theme.warn} stopOpacity={0.68} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.border} opacity={0.75} />
            <XAxis dataKey="periode" tick={axisTick} axisLine={{ stroke: theme.border }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => nf.format(v)} width={50} />
            <Tooltip
              cursor={{ fill: theme.border, opacity: 0.2 }}
              content={<EditorialTooltip formatValue={(v) => fcfa(v)} />}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" iconSize={8} />
            <Bar dataKey="bpa" name="BPA" fill={`url(#fc-bpa-${uid})`} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            <Bar dataKey="dividende" name="Dividende / action" fill={`url(#fc-div-${uid})`} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </ComposedChart>
        </Panel>
      )}

      {/* Banques : crédits vs dépôts */}
      {hasBank && (
        <Panel title="Crédits & dépôts à la clientèle" hint="Md FCFA · ligne = taux de transformation (%)">
          <ComposedChart data={bankData} margin={{ left: 4, right: 8, top: 8, bottom: 2 }}>
            <defs>
              <linearGradient id={`fc-dep-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.up} stopOpacity={0.9} />
                <stop offset="100%" stopColor={theme.up} stopOpacity={0.65} />
              </linearGradient>
              <linearGradient id={`fc-cred-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.accent} stopOpacity={0.92} />
                <stop offset="100%" stopColor={theme.accent} stopOpacity={0.68} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.border} opacity={0.75} />
            <XAxis dataKey="periode" tick={axisTick} axisLine={{ stroke: theme.border }} tickLine={false} />
            <YAxis yAxisId="mrd" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1e9)}`} width={48} />
            <YAxis yAxisId="pct" orientation="right" tick={{ ...axisTick, fill: theme.warn }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v)} %`} width={44} />
            <Tooltip
              cursor={{ fill: theme.border, opacity: 0.2 }}
              content={
                <EditorialTooltip
                  formatValue={(v, name) => (name === 'Transformation' ? `${v.toFixed(0)} %` : md(v))}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" iconSize={8} />
            <Bar yAxisId="mrd" dataKey="depots" name="Dépôts" fill={`url(#fc-dep-${uid})`} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            <Bar yAxisId="mrd" dataKey="credits" name="Crédits" fill={`url(#fc-cred-${uid})`} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            <Line
              type="monotone"
              yAxisId="pct"
              name="Transformation"
              dataKey={(d: FundaChartPoint) => (d.depots && d.credits != null ? (d.credits / d.depots) * 100 : null)}
              stroke={theme.warn}
              strokeWidth={2.25}
              dot={{ r: 3.5, fill: theme.surface, stroke: theme.warn, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: theme.warn, stroke: theme.surface, strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </Panel>
      )}
    </div>
  );
}
