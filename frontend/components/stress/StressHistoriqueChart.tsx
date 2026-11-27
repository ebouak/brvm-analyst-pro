'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { chartTheme } from '@/lib/chartTheme';
import { fmtDateCourte, fmtNumber, fmtPctSigne } from '@/lib/format';
import type { StressDailyRow } from '@/lib/stress/stressIndexTypes';

export function BoutonImprimerStress() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-elevated px-3 py-1.5 text-xs font-medium text-ivory transition-colors hover:border-accent"
    >
      <Printer className="h-3.5 w-3.5 text-accent-ink" strokeWidth={1.75} />
      Imprimer / PDF
    </button>
  );
}

export function StressHistoriqueChart({ historique }: { historique: readonly StressDailyRow[] }) {
  const [fenetre, setFenetre] = useState<60 | 180>(180);
  const theme = chartTheme();

  const serie = historique.slice(-fenetre).map((r) => ({
    date: r.date_marche,
    stress: r.stress_index,
    dd: r.observables_marche.drawdown_brvmc_pct,
    brvmc: r.observables_marche.brvmc_cloture,
  }));

  if (serie.length < 2) {
    return (
      <p className="rounded-lg border border-border bg-sunken p-4 text-xs text-muted">
        Historique insuffisant pour tracer la trajectoire de tension.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-ivory">Évolution de l’indice de tension (0–100)</h3>
          <p className="text-xs text-muted">
            Seuils descriptifs : 25 (modérée) · 50 (élevée) · 75 (extrême).
          </p>
        </div>

        <div className="print:hidden flex gap-1 text-xs">
          {([60, 180] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setFenetre(n)}
              className={`rounded-md border px-2.5 py-1 font-medium ${
                fenetre === n
                  ? 'border-accent-ink bg-accent-ink text-bg'
                  : 'border-border bg-sunken text-muted hover:text-ivory'
              }`}
            >
              {n} séances
            </button>
          ))}
        </div>
      </div>

      <div className="h-[250px] w-full rounded-lg border border-border/60 bg-sunken p-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={serie} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={theme.border} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fill: theme.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: theme.border }}
              tickFormatter={(d) => fmtDateCourte(String(d))}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: theme.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine y={50} stroke={theme.warn} strokeDasharray="3 3" />
            <ReferenceLine y={75} stroke={theme.down} strokeDasharray="3 3" />
            <Tooltip
              content={({ active, payload }) => {
                const pt = active && payload?.[0]?.payload ? (payload[0].payload as (typeof serie)[number]) : null;
                if (!pt) return null;
                return (
                  <div className="rounded-lg border border-border bg-surface p-2.5 text-xs shadow-card space-y-0.5">
                    <p className="font-semibold text-ivory">{fmtDateCourte(pt.date)}</p>
                    <p className="tabular text-ivory">Indice de tension : {fmtNumber(pt.stress, 1)} / 100</p>
                    <p className="tabular text-down">Drawdown BRVMC : {fmtPctSigne(pt.dd, 2)}</p>
                    <p className="tabular text-muted">BRVMC : {fmtNumber(pt.brvmc, 2)} pts</p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="stress"
              stroke={theme.accent}
              fill={theme.alpha('accent', 0.16)}
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
