'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { chartTheme } from '@/lib/chartTheme';
import { fmtNumber, fmtPctSigne } from '@/lib/format';
import type { ActionResilienceRow } from '@/lib/stress/resilienceTypes';

type FiltreFamille = 'toutes' | 'banque' | 'general';
type AxeY = 'roe' | 'per' | 'rendement_div';

export function RadarValorisations({
  actions,
  onSelectAction,
}: {
  actions: readonly ActionResilienceRow[];
  onSelectAction: (action: ActionResilienceRow) => void;
}) {
  const [famille, setFamille] = useState<FiltreFamille>('toutes');
  const [axeY, setAxeY] = useState<AxeY>('roe');
  const theme = chartTheme();

  const points = useMemo(() => {
    return actions
      .filter((a) => {
        if (famille === 'banque' && a.famille_comptable !== 'banque') return false;
        if (famille === 'general' && a.famille_comptable === 'banque') return false;
        if (a.drawdown_pct == null) return false;
        if (axeY === 'per') return a.fondamentaux.per != null && a.fondamentaux.per > 0 && a.fondamentaux.per < 45;
        if (axeY === 'rendement_div') return a.dividendes.rendement_pct != null && a.dividendes.rendement_pct > 0;
        return a.fondamentaux.roe_pct != null && a.fondamentaux.roe_pct > -40 && a.fondamentaux.roe_pct < 60;
      })
      .map((a) => ({
        code: a.code,
        designation: a.designation,
        secteur: a.secteur,
        famille: a.famille_comptable,
        x: a.drawdown_pct!,
        y:
          axeY === 'per'
            ? a.fondamentaux.per!
            : axeY === 'rendement_div'
              ? a.dividendes.rendement_pct!
              : a.fondamentaux.roe_pct!,
        z: Math.max(20, a.liquidite.score_v2 ?? 35),
        raw: a,
      }));
  }, [actions, famille, axeY]);

  const banques = useMemo(() => points.filter((p) => p.famille === 'banque'), [points]);
  const autres = useMemo(() => points.filter((p) => p.famille !== 'banque'), [points]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ivory">Nuage des décrochages & ratios publiés</h3>
          <p className="text-xs text-muted">
            Drawdown (%) vs {axeY === 'per' ? 'PER (x)' : axeY === 'rendement_div' ? 'Rendement dividende (%)' : 'ROE publié (%)'}. Banques et valeurs générales distinguées.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            aria-label="Famille comptable"
            value={famille}
            onChange={(e) => setFamille(e.target.value as FiltreFamille)}
            className="rounded-lg border border-border bg-sunken px-2.5 py-1.5 text-ivory focus:border-accent focus:outline-none"
          >
            <option value="toutes">Toutes familles</option>
            <option value="banque">Banques uniquement</option>
            <option value="general">Hors banques</option>
          </select>

          <select
            aria-label="Axe vertical"
            value={axeY}
            onChange={(e) => setAxeY(e.target.value as AxeY)}
            className="rounded-lg border border-border bg-sunken px-2.5 py-1.5 text-ivory focus:border-accent focus:outline-none"
          >
            <option value="roe">ROE publié (%)</option>
            <option value="per">PER (x)</option>
            <option value="rendement_div">Rendement dividende (%)</option>
          </select>
        </div>
      </div>

      {points.length === 0 ? (
        <p className="rounded-lg border border-border bg-sunken p-4 text-xs text-muted">
          Pas assez de valeurs renseignées pour cette combinaison d&apos;axes.
        </p>
      ) : (
        <div className="h-[310px] w-full rounded-lg border border-border/60 bg-sunken p-3">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 16, bottom: 10, left: 4 }}>
              <CartesianGrid stroke={theme.border} strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                name="Drawdown"
                tick={{ fill: theme.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: theme.border }}
                tickFormatter={(v) => `${v} %`}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={axeY}
                tick={{ fill: theme.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (axeY === 'per' ? `${v}x` : `${v} %`)}
              />
              <ZAxis type="number" dataKey="z" range={[60, 260]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3', stroke: theme.border }}
                content={({ active, payload }) => {
                  const pt = active && payload?.[0]?.payload ? (payload[0].payload as (typeof points)[number]) : null;
                  if (!pt) return null;
                  return (
                    <div className="rounded-lg border border-border bg-surface p-2.5 text-xs shadow-card">
                      <p className="font-semibold text-ivory">
                        {pt.code} · {pt.designation}
                      </p>
                      <p className="text-faint">{pt.secteur}</p>
                      <p className="tabular mt-1 text-down">Drawdown : {fmtPctSigne(pt.x, 1)}</p>
                      <p className="tabular text-ivory">
                        {axeY === 'per' ? 'PER' : axeY === 'rendement_div' ? 'Rdt div.' : 'ROE'} :{' '}
                        {fmtNumber(pt.y, 1)} {axeY === 'per' ? 'x' : '%'}
                      </p>
                      <p className="tabular text-muted">
                        Liquidité v2 : {pt.raw.liquidite.score_v2 != null ? `${fmtNumber(pt.raw.liquidite.score_v2, 0)}/100` : '—'}
                      </p>
                    </div>
                  );
                }}
              />
              {autres.length > 0 && (
                <Scatter
                  name="Hors banques"
                  data={autres}
                  fill={theme.accent}
                  onClick={(pt) => {
                    if (pt?.raw) onSelectAction(pt.raw as ActionResilienceRow);
                  }}
                />
              )}
              {banques.length > 0 && (
                <Scatter
                  name="Banques"
                  data={banques}
                  fill={theme.warn}
                  onClick={(pt) => {
                    if (pt?.raw) onSelectAction(pt.raw as ActionResilienceRow);
                  }}
                />
              )}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
