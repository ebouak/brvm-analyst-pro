'use client';

import { useMemo, useState } from 'react';
import { aggregateSeasonality, type MonthlyReturn, type MonthStats, type Verdict } from '@/lib/seasonality/compute';
import type { FaitLu } from '@/lib/seasonality/server';
import GrilleAnnees from './GrilleAnnees';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const WINDOWS = [5, 10, 15] as const;
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1).replace('.', ',')}\u00a0%`;
const VERDICT: Record<Verdict, string> = {
  etabli: 'régularité établie',
  indicatif: 'indicative',
  hasard: 'non distinguable du hasard',
};
/** Couleur d'un rendement : une cellule « hasard » reste grise, jamais verte ni rouge. */
const ton = (m: MonthStats) => (m.verdict === 'hasard' ? 'text-muted' : m.medianReturn >= 0 ? 'text-up' : 'text-down');

export default function SeasonalityMatrix({
  returns,
  returnsPrix,
  anneesDifficiles = [],
  detachementsParMois,
  faits = [],
  marche,
  preview = false,
}: {
  /** Rendement mensuel du marché : chaque cellule montre la part du marché (F8). */
  marche?: MonthlyReturn[];
  /** Rendements mensuels, dividende réinvesti quand la table est alimentée. */
  returns: MonthlyReturn[];
  /** Même série en cours seul ; absente = pas de bascule (calcul de repli). */
  returnsPrix?: MonthlyReturn[];
  anneesDifficiles?: number[];
  /** Années où chaque mois (index 0 = janvier) a porté un détachement. */
  detachementsParMois?: number[];
  /** Faits mensuels lus en base, pour la grille des années. */
  faits?: FaitLu[];
  /**
   * Essai gratuit : ne révèle que le MOIS EN COURS, cadenasse les onze autres et
   * masque la table détaillée + les extrêmes. Donne un aperçu tangible sans livrer
   * toute l'analyse — le reste appelle l'abonnement Premium.
   */
  preview?: boolean;
}) {
  const [windowYears, setWindowYears] = useState<number>(10);
  const [mode, setMode] = useState<'total' | 'prix'>('total');
  const [horsDifficulte, setHorsDifficulte] = useState(false);
  const retenus = useMemo(() => {
    const base = mode === 'prix' && returnsPrix ? returnsPrix : returns;
    return horsDifficulte ? base.filter((x) => !anneesDifficiles.includes(x.year)) : base;
  }, [mode, horsDifficulte, returns, returnsPrix, anneesDifficiles]);
  const r = useMemo(() => aggregateSeasonality(retenus, windowYears), [retenus, windowYears]);
  const rm = useMemo(() => (marche && marche.length ? aggregateSeasonality(marche, windowYears) : null), [marche, windowYears]);
  const currentMonth = new Date().getMonth() + 1; // 1-12

  if (returns.length === 0) {
    return <p className="text-sm text-muted">Historique indisponible pour ce titre.</p>;
  }

  const cellBg = (m: MonthStats) =>
    m.n === 0 || m.verdict === 'hasard' ? 'border-border bg-surface'
      : m.medianReturn > 0 ? 'bg-up/10 border-up/30' : 'bg-down/10 border-down/30';
  const fort = r.matrix.find((m) => m.month === r.bestMonth) ?? null;
  const faible = r.matrix.find((m) => m.month === r.worstMonth) ?? null;

  return (
    <div className="space-y-4">
      {/* Sélecteur de fenêtre — masqué en essai (une seule lecture proposée). */}
      {!preview && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-faint">Fenêtre :</span>
          {WINDOWS.map((w) => (
            <button key={w} type="button" onClick={() => setWindowYears(w)}
              className={`text-xs px-2.5 py-1 rounded-md border ${windowYears === w ? 'border-info text-accent-ink bg-info/10' : 'border-border text-muted'}`}>
              {w} ans
            </button>
          ))}
          <span className="ml-auto text-xs text-faint">{r.yearsCovered} an(s) de données</span>
        </div>
      )}
      {!preview && (returnsPrix || anneesDifficiles.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {returnsPrix && (
            <>
              <span className="text-xs text-faint">Rendement :</span>
              {(['total', 'prix'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                  className={`text-xs px-2.5 py-1 rounded-md border ${mode === m ? 'border-info text-accent-ink bg-info/10' : 'border-border text-muted'}`}>
                  {m === 'total' ? 'dividende réinvesti' : 'cours seul'}
                </button>
              ))}
            </>
          )}
          {anneesDifficiles.length > 0 && (
            <button type="button" aria-pressed={horsDifficulte} onClick={() => setHorsDifficulte((v) => !v)}
              className={`text-xs px-2.5 py-1 rounded-md border ${horsDifficulte ? 'border-info text-accent-ink bg-info/10' : 'border-border text-muted'}`}>
              hors années de difficulté ({anneesDifficiles.length})
            </button>
          )}
        </div>
      )}

      {preview && (
        <div className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-accent-ink">
          Aperçu gratuit : seul le mois en cours est révélé. La matrice complète, les
          mois qui se détachent et la table détaillée sont réservés au premium.
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
                <span className="text-xs font-semibold text-faint">{MONTHS[m.month - 1]}</span>
                <div className="mt-1 flex items-center gap-1 text-faint">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect x="4" y="10" width="16" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  <span className="text-xs">Premium</span>
                </div>
              </div>
            );
          }
          return (
            <div key={m.month} className={`rounded-lg border p-2.5 ${cellBg(m)} ${preview ? 'ring-1 ring-gold/40' : ''}`}>
              <span className="text-xs font-semibold text-white">{MONTHS[m.month - 1]}</span>
              {m.n === 0 ? (
                <p className="mt-1 text-xs text-faint">aucune donnée</p>
              ) : (
                <>
                  <p className={`mt-1 tabular text-sm font-bold ${ton(m)}`}>{pct(m.medianReturn)}</p>
                  <p className="text-xs text-faint">médiane · {m.n} an{m.n > 1 ? 's' : ''}</p>
                  {rm && rm.matrix[m.month - 1]!.n > 0 && (
                    <p className="text-xs text-faint">dont marché {pct(rm.matrix[m.month - 1]!.medianReturn)}</p>
                  )}
                  <p className="text-xs text-faint">en hausse {m.bullPct.toFixed(0)}&nbsp;%</p>
                  <p className={`mt-1 text-xs ${m.verdict === 'hasard' ? 'text-faint' : 'text-muted'}`}>{VERDICT[m.verdict]}</p>
                  {(detachementsParMois?.[m.month - 1] ?? 0) > 0 && (
                    <p className="text-xs text-faint">détachement {detachementsParMois![m.month - 1]} an{detachementsParMois![m.month - 1]! > 1 ? 's' : ''}</p>
                  )}
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
          className="block rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-center text-sm font-semibold text-accent-ink transition hover:bg-gold/10"
        >
          Débloquer les 12 mois, les mois qui se détachent et la table détaillée · Passer à Premium
        </a>
      )}

      {/* Mois qui se détachent + habitude du mois en cours — réservés au premium. */}
      {!preview && (
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        {fort || faible ? (
          <>
            <div className="rounded-lg border border-border bg-surface p-2">
              <p className="text-faint">Mois habituellement fort</p>
              {fort ? (
                <p className="font-semibold text-up">{MONTHS[fort.month - 1]} <span className="tabular">{pct(fort.medianReturn)}</span> <span className="font-normal text-faint">médiane, {fort.n} ans, {VERDICT[fort.verdict]}</span></p>
              ) : <p className="text-muted">aucun ne se détache</p>}
            </div>
            <div className="rounded-lg border border-border bg-surface p-2">
              <p className="text-faint">Mois habituellement faible</p>
              {faible ? (
                <p className="font-semibold text-down">{MONTHS[faible.month - 1]} <span className="tabular">{pct(faible.medianReturn)}</span> <span className="font-normal text-faint">médiane, {faible.n} ans, {VERDICT[faible.verdict]}</span></p>
              ) : <p className="text-muted">aucun ne se détache</p>}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-border bg-surface p-2 sm:col-span-2">
            <p className="text-faint">Mois forts et faibles</p>
            <p className="text-muted">Aucun mois ne se détache : sur cette fenêtre, aucune régularité ne se distingue du hasard.</p>
          </div>
        )}
        <div className="rounded-lg border border-border bg-surface p-2">
          <p className="text-faint">Habitude du mois en cours</p>
          {r.currentMonthBias && r.currentMonthBias.n > 0 ? (
            <p className={`font-semibold ${ton(r.currentMonthBias)}`}>{MONTHS[r.currentMonthBias.month - 1]} <span className="tabular">{pct(r.currentMonthBias.medianReturn)}</span> <span className="font-normal text-faint">médiane, {r.currentMonthBias.n} ans, {VERDICT[r.currentMonthBias.verdict]}</span></p>
          ) : <p className="text-muted">aucune donnée</p>}
        </div>
      </div>
      )}

      {/* Table détaillée — réservée au premium. */}
      {!preview && (
      <div tabIndex={0} role="region" aria-label="Tableau, défilement horizontal" className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl border border-border">
        <table className="w-full text-[13px]">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left">Mois</th>
              <th className="px-3 py-2 text-right">Médiane</th>
              <th className="px-3 py-2 text-right">Moyenne</th>
              <th className="px-3 py-2 text-right">Écart-type</th>
              <th className="px-3 py-2 text-right">En hausse</th>
              <th className="px-3 py-2 text-right">Années</th>
              <th className="px-3 py-2 text-left">Fiabilité</th>
            </tr>
          </thead>
          <tbody>
            {r.matrix.map((m) => (
              <tr key={m.month} className="border-t border-border/50">
                <td className="px-3 py-1.5 text-white">{MONTHS[m.month - 1]}</td>
                <td className={`px-3 py-1.5 text-right tabular ${ton(m)}`}>{m.n ? pct(m.medianReturn) : '—'}</td>
                <td className="px-3 py-1.5 text-right tabular text-muted">{m.n ? pct(m.avgReturn) : '—'}</td>
                <td className="px-3 py-1.5 text-right tabular text-muted">{m.volatility != null ? `${(m.volatility * 100).toFixed(1).replace('.', ',')}\u00a0%` : '—'}</td>
                <td className="px-3 py-1.5 text-right tabular text-muted">{m.n ? `${m.bullPct.toFixed(0)}\u00a0%` : '—'}</td>
                <td className="px-3 py-1.5 text-right tabular text-faint">{m.n}</td>
                <td className="px-3 py-1.5 text-left text-faint">{m.n ? VERDICT[m.verdict] : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      {!preview && faits.length > 0 && (
        <GrilleAnnees faits={faits} rets={retenus} mode={returnsPrix ? mode : 'total'}
          anneesDifficiles={anneesDifficiles} horsDifficulte={horsDifficulte} windowYears={windowYears} />
      )}
    </div>
  );
}
