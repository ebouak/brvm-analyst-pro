'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { chartTheme } from '@/lib/chartTheme';
import { fmtDateCourte, fmtNumber } from '@/lib/format';
import { NIVEAUX_COURTS, regimeDe, reperesFenetre } from '@/lib/stress/bulletin';
import type { StressDailyRow } from '@/lib/stress/stressIndexTypes';

const PERIODES = [
  { id: '3m', libelle: '3 mois', n: 63 },
  { id: '6m', libelle: '6 mois', n: 126 },
  { id: 'tout', libelle: 'Tout', n: Number.POSITIVE_INFINITY },
] as const;
type IdPeriode = (typeof PERIODES)[number]['id'];

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

export function StressHistoriqueChart({
  historique,
  dateSommet = null,
}: {
  historique: readonly StressDailyRow[];
  /** Date du plus haut du Composite : repère dessiné s'il est dans la période affichée. */
  dateSommet?: string | null;
}) {
  const [periode, setPeriode] = useState<IdPeriode>('6m');
  const theme = chartTheme();
  const choix = PERIODES.find((p) => p.id === periode) ?? PERIODES[1];

  const serie = (Number.isFinite(choix.n) ? historique.slice(-choix.n) : historique).map((r) => ({
    date: r.date_marche,
    stress: r.stress_index,
    dd: r.observables_marche.drawdown_brvmc_pct,
    brvmc: r.observables_marche.brvmc_cloture,
  }));
  const reperes = reperesFenetre(
    serie.map((p) => ({ date: p.date, valeur: p.stress })),
    dateSommet,
  );

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
          <h3 className="text-base font-semibold text-ivory">La tension, séance après séance</h3>
          <p className="text-xs text-muted">
            Repères : 25 modérée · 50 élevée · 75 extrême. Survolez la courbe pour le détail d&apos;une séance.
          </p>
        </div>

        <div className="print:hidden flex gap-1 text-xs" role="group" aria-label="Période affichée">
          {PERIODES.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={periode === p.id}
              onClick={() => setPeriode(p.id)}
              className={`rounded-md border px-2.5 py-1 font-medium ${
                periode === p.id
                  ? 'border-accent-ink bg-accent-ink text-bg'
                  : 'border-border bg-sunken text-muted hover:text-ivory'
              }`}
            >
              {p.libelle}
            </button>
          ))}
        </div>
      </div>

      <div
        role="img"
        aria-label={`Évolution de l'indice de tension, ${choix.libelle.toLowerCase()}`}
        className="h-[280px] w-full rounded-lg border border-border/60 bg-sunken p-3"
      >
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
            {/* Repères neutres (pas de rouge d'alarme) : ils situent un niveau, ils ne jugent pas. */}
            <ReferenceLine y={50} stroke={theme.muted} strokeDasharray="3 3" />
            <ReferenceLine y={75} stroke={theme.muted} strokeDasharray="3 3" />
            <Tooltip
              content={({ active, payload }) => {
                const pt = active && payload?.[0]?.payload ? (payload[0].payload as (typeof serie)[number]) : null;
                if (!pt) return null;
                return (
                  <div className="rounded-lg border border-border bg-surface p-2.5 text-xs shadow-card space-y-0.5">
                    <p className="font-semibold text-ivory">{fmtDateCourte(pt.date)}</p>
                    <p className="tabular text-ivory">
                      Tension : {fmtNumber(pt.stress, 1)} / 100 ({NIVEAUX_COURTS[regimeDe(pt.stress)]})
                    </p>
                    <p className="tabular text-muted">Composite : {fmtNumber(pt.brvmc, 2)} pts</p>
                    <p className="tabular text-muted">Recul depuis le plus haut : {fmtNumber(Math.abs(pt.dd), 2)} %</p>
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
            {reperes.map((r) => (
              <ReferenceDot
                key={`${r.date}-${r.libelle}`}
                x={r.date}
                y={r.valeur}
                r={4}
                fill={theme.accent}
                stroke={theme.surface}
                label={{ value: r.libelle, position: 'top', fill: theme.muted, fontSize: 11 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
