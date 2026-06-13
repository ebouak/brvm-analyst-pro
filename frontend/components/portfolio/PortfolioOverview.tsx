'use client';

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { PortfolioState } from '@/lib/portfolio/derive';
import { fmtFcfa } from '@/lib/format';

function pct(v: number | null): string {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}
function pnlClass(v: number): string {
  return v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted';
}

interface Props {
  state: PortfolioState | null;
  isLoading?: boolean;
}

/**
 * Vue d'ensemble du portefeuille — entièrement DÉRIVÉE des positions réelles.
 * KPIs, courbe d'équité (base 100), répartition sectorielle et détail par
 * position partagent une seule et même source de vérité (derivePortfolio).
 */
export default function PortfolioOverview({ state, isLoading = false }: Props) {
  const curve = useMemo(() => {
    if (!state || state.equityCurve.length === 0) return [];
    const base = state.equityCurve[0]!.invested || state.equityCurve[0]!.value || 1;
    return state.equityCurve.map((p) => ({
      date: p.date,
      label: new Date(p.date).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      indice: +((p.value / base) * 100).toFixed(2),
    }));
  }, [state]);

  if (isLoading) {
    return <div className="h-64 bg-elevated rounded-xl animate-pulse" />;
  }

  if (!state || state.positions.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-10 text-center">
        <p className="text-muted text-sm">Aucune position. Ajoutez des titres dans « Mon portefeuille » pour voir l’analyse.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs dérivés */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Valorisation" value={fmtFcfa(state.currentValue)} unit="FCFA" />
        <Kpi label="Capital investi" value={fmtFcfa(state.investedCapital)} unit="FCFA" />
        <Kpi label="P&L latent" value={fmtFcfa(state.latentPnl)} unit="FCFA" cls={pnlClass(state.latentPnl)} />
        <Kpi label="Rendement total" value={pct(state.totalReturn)} cls={pnlClass(state.totalReturn)} />
        <Kpi label="Max drawdown" value={`-${(state.maxDrawdown * 100).toFixed(1)}%`} cls="text-down" />
      </div>

      {/* Courbe d'équité (base 100) — auto-dérivée */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">📈 Évolution du portefeuille (base 100)</h3>
          {state.annualizedReturn != null && (
            <span className={`text-sm font-semibold ${pnlClass(state.annualizedReturn)}`}>{pct(state.annualizedReturn)}/an</span>
          )}
        </div>
        {curve.length < 2 ? (
          <div className="h-56 flex items-center justify-center text-muted text-sm">
            Historique insuffisant pour tracer la courbe (positions trop récentes).
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={curve} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00c853" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#00c853" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#232733" vertical={false} />
              <XAxis dataKey="label" stroke="#8b93a7" style={{ fontSize: 11 }} minTickGap={28} />
              <YAxis stroke="#8b93a7" style={{ fontSize: 11 }} domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#161922', border: '1px solid #232733', borderRadius: 6, color: '#e6e9f0' }}
                formatter={(v: number) => [v.toFixed(2), 'Base 100']}
              />
              <ReferenceLine y={100} stroke="#8b93a7" strokeDasharray="5 5" />
              <Area type="monotone" dataKey="indice" stroke="#00c853" strokeWidth={2} fill="url(#eqGrad)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Répartition sectorielle + positions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Répartition sectorielle</h3>
          <ul className="space-y-2">
            {state.sectors.map((s) => (
              <li key={s.secteur} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">{s.secteur}</span>
                  <span className="tabular text-ivory">{(s.poids * 100).toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-border overflow-hidden">
                  <div className="h-full bg-up/60 rounded-full" style={{ width: `${(s.poids * 100).toFixed(1)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-surface border border-border rounded-xl p-4 overflow-x-auto">
          <h3 className="text-sm font-semibold text-white mb-3">Positions ({state.positions.length})</h3>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted border-b border-border">
              <tr>
                <th className="text-left py-2">Titre</th>
                <th className="text-right py-2">Valeur</th>
                <th className="text-right py-2">Poids</th>
                <th className="text-right py-2">P&L</th>
              </tr>
            </thead>
            <tbody>
              {state.positions.map((p) => (
                <tr key={p.code} className="border-b border-border/40">
                  <td className="py-2 font-medium text-white">{p.code}</td>
                  <td className="py-2 text-right tabular text-ivory">{fmtFcfa(p.valeur)}</td>
                  <td className="py-2 text-right tabular text-muted">{(p.poids * 100).toFixed(1)}%</td>
                  <td className={`py-2 text-right tabular font-medium ${pnlClass(p.pnl)}`}>{pct(p.pnlPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, unit, cls }: { label: string; value: string; unit?: string; cls?: string }) {
  return (
    <div className="bg-bg/40 border border-border/60 rounded-xl p-4">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`tabular text-lg font-mono font-semibold ${cls ?? 'text-white'}`}>
        {value}{unit ? <span className="text-xs text-faint ml-1">{unit}</span> : null}
      </div>
    </div>
  );
}
