'use client';

import { useMemo, useState } from 'react';
import { aggregateSeasonality, type MonthlyReturn } from '@/lib/seasonality/compute';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const WINDOWS = [5, 10, 15] as const;
const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

export default function SeasonalityMatrix({
  returns,
  preview = false,
}: {
  returns: MonthlyReturn[];
  /**
   * Essai gratuit : ne révèle que le MOIS EN COURS, cadenasse les onze autres et
   * masque la table détaillée + les extrêmes. Donne un aperçu tangible sans livrer
   * toute l'analyse — le reste appelle l'abonnement Premium.
   */
  preview?: boolean;
}) {
  const [windowYears, setWindowYears] = useState<number>(10);
  const r = useMemo(() => aggregateSeasonality(returns, windowYears), [returns, windowYears]);
  const currentMonth = new Date().getMonth() + 1; // 1-12

  if (returns.length === 0) {
    return <p className="text-sm text-muted">Historique indisponible pour ce titre.</p>;
  }

  const cellBg = (avg: number, n: number) =>
    n === 0 ? 'bg-surface' : avg > 0 ? 'bg-up/10 border-up/30' : avg < 0 ? 'bg-down/10 border-down/30' : 'bg-surface';

  return (
    <div className="space-y-4">
      {/* Sélecteur de fenêtre — masqué en essai (une seule lecture proposée). */}
      {!preview && (
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
      )}

      {preview && (
        <div className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-gold">
          Aperçu gratuit : seul le mois en cours est révélé. La matrice complète, les
          meilleurs/pires mois et la table détaillée sont réservés au premium.
        </div>
      )}

      {/* Bandeau qualité */}
      {r.dataQuality !== 'robust' && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${r.dataQuality === 'insufficient' ? 'border-down/30 bg-down/5 text-down' : 'border-warn/30 bg-warn/5 text-warn'}`}>
          {r.dataQuality === 'insufficient'
            ? 'Historique court (< 5 ans) : saisonnalité peu fiable, à interpréter avec prudence.'
            : 'Fenêtre limitée (5-9 ans) : tendances indicatives.'}
        </div>
      )}

      {/* Matrice 12 mois. En essai : seul le mois en cours est révélé. */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {r.matrix.map((m) => {
          const locked = preview && m.month !== currentMonth;
          if (locked) {
            return (
              <div
                key={m.month}
                className="relative rounded-lg border border-border bg-surface p-2.5 overflow-hidden"
              >
                <span className="text-[11px] font-semibold text-faint">{MONTHS[m.month - 1]}</span>
                <div className="mt-1 flex items-center gap-1 text-faint">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect x="4" y="10" width="16" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  <span className="text-[10px]">Premium</span>
                </div>
              </div>
            );
          }
          return (
            <div key={m.month} className={`rounded-lg border p-2.5 ${cellBg(m.avgReturn, m.n)} ${preview ? 'ring-1 ring-gold/40' : ''}`}>
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
          );
        })}
      </div>

      {/* En essai : appel à l'abonnement à la place des analyses complètes. */}
      {preview && (
        <a
          href="/account/plan"
          className="block rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-center text-sm font-semibold text-gold transition hover:bg-gold/10"
        >
          Débloquer les 12 mois, les extrêmes et la table détaillée — Passer à Premium →
        </a>
      )}

      {/* Extrêmes + biais — réservés au premium. */}
      {!preview && (
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
      )}

      {/* Table détaillée — réservée au premium. */}
      {!preview && (
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
      )}
    </div>
  );
}
