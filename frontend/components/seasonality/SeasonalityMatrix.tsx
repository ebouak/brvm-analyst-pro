'use client';

import { useMemo, useState } from 'react';
import { aggregateSeasonality, type MonthlyReturn } from '@/lib/seasonality/compute';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const WINDOWS = [5, 10, 15] as const;
const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

export default function SeasonalityMatrix({ returns }: { returns: MonthlyReturn[] }) {
  const [windowYears, setWindowYears] = useState<number>(10);
  const r = useMemo(() => aggregateSeasonality(returns, windowYears), [returns, windowYears]);

  if (returns.length === 0) {
    return <p className="text-sm text-muted">Historique indisponible pour ce titre.</p>;
  }

  const cellBg = (avg: number, n: number) =>
    n === 0 ? 'bg-surface' : avg > 0 ? 'bg-up/10 border-up/30' : avg < 0 ? 'bg-down/10 border-down/30' : 'bg-surface';

  return (
    <div className="space-y-4">
      {/* Sélecteur de fenêtre */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-faint">Fenêtre :</span>
        {WINDOWS.map((w) => (
          <button key={w} type="button" onClick={() => setWindowYears(w)}
            className={`text-xs px-2.5 py-1 rounded-md border ${windowYears === w ? 'border-info text-info bg-info/10' : 'border-border text-muted'}`}>
            {w} ans
          </button>
        ))}
        <span className="ml-auto text-[11px] text-faint">{r.yearsCovered} an(s) de données</span>
      </div>

      {/* Bandeau qualité */}
      {r.dataQuality !== 'robust' && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${r.dataQuality === 'insufficient' ? 'border-down/30 bg-down/5 text-down' : 'border-warn/30 bg-warn/5 text-warn'}`}>
          {r.dataQuality === 'insufficient'
            ? 'Historique court (< 5 ans) : saisonnalité peu fiable, à interpréter avec prudence.'
            : 'Fenêtre limitée (5-9 ans) : tendances indicatives.'}
        </div>
      )}

      {/* Matrice 12 mois */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {r.matrix.map((m) => (
          <div key={m.month} className={`rounded-lg border p-2.5 ${cellBg(m.avgReturn, m.n)}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white">{MONTHS[m.month - 1]}</span>
              {m.reliability === 'low' && m.n > 0 && (
                <span className={`text-[8px] px-1 rounded ${m.n < 3 ? 'bg-down/20 text-down' : 'bg-warn/20 text-warn'}`}>N={m.n}</span>
              )}
            </div>
            {m.n === 0 ? (
              <p className="mt-1 text-[10px] text-faint">aucune donnée</p>
            ) : (
              <>
                <p className={`mt-1 tabular text-sm font-bold ${m.avgReturn >= 0 ? 'text-up' : 'text-down'}`}>{pct(m.avgReturn)}</p>
                <p className="text-[10px] text-faint">hausse {m.bullPct.toFixed(0)}% · N={m.n}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Extrêmes + biais */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-up/30 bg-up/5 p-2">
          <p className="text-faint">Meilleur mois</p>
          <p className="font-semibold text-up">{r.bestMonth ? MONTHS[r.bestMonth - 1] : '—'}</p>
        </div>
        <div className="rounded-lg border border-down/30 bg-down/5 p-2">
          <p className="text-faint">Pire mois</p>
          <p className="font-semibold text-down">{r.worstMonth ? MONTHS[r.worstMonth - 1] : '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-2">
          <p className="text-faint">Biais mois en cours</p>
          <p className="font-semibold text-white">
            {r.currentMonthBias && r.currentMonthBias.n > 0
              ? `${MONTHS[r.currentMonthBias.month - 1]} ${pct(r.currentMonthBias.avgReturn)}`
              : '—'}
          </p>
        </div>
      </div>

      {/* Table détaillée */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-[13px]">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left">Mois</th>
              <th className="px-3 py-2 text-right">Moy.</th>
              <th className="px-3 py-2 text-right">Médiane</th>
              <th className="px-3 py-2 text-right">Volatilité</th>
              <th className="px-3 py-2 text-right">Hausse %</th>
              <th className="px-3 py-2 text-right">N</th>
            </tr>
          </thead>
          <tbody>
            {r.matrix.map((m) => (
              <tr key={m.month} className="border-t border-border/50">
                <td className="px-3 py-1.5 text-white">{MONTHS[m.month - 1]}</td>
                <td className={`px-3 py-1.5 text-right tabular ${m.avgReturn >= 0 ? 'text-up' : 'text-down'}`}>{m.n ? pct(m.avgReturn) : '—'}</td>
                <td className="px-3 py-1.5 text-right tabular text-muted">{m.n ? pct(m.medianReturn) : '—'}</td>
                <td className="px-3 py-1.5 text-right tabular text-muted">{m.volatility != null ? `${(m.volatility * 100).toFixed(1)}%` : '—'}</td>
                <td className="px-3 py-1.5 text-right tabular text-muted">{m.n ? `${m.bullPct.toFixed(0)}%` : '—'}</td>
                <td className="px-3 py-1.5 text-right tabular text-faint">{m.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
