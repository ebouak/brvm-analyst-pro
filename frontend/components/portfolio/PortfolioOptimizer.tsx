'use client';

import { useState } from 'react';
import { usePortfolioOptimizer } from '@/lib/portfolio/useOptimizer';
import { rebalanceTrades, equalWeights } from '@/lib/portfolio/rebalanceTrades';

const pct = (v: number | null | undefined, d = 1) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`);
const pctAbs = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
const fcfa = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} FCFA`;

type Cible = 'maxSharpe' | 'minVariance' | 'equal';

/** Optimiseur Markowitz : allocation actuelle vs min-variance / max-Sharpe + rééquilibrage. */
export default function PortfolioOptimizer({ userId }: { userId: string }) {
  const { data, positions, isLoading, insufficient } = usePortfolioOptimizer(userId);
  const [cible, setCible] = useState<Cible>('maxSharpe');

  if (isLoading) return <div className="h-48 bg-elevated rounded-xl animate-pulse" />;

  if (insufficient || !data) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center">
        <p className="text-sm text-muted">Optimisation indisponible.</p>
        <p className="mt-1 text-xs text-faint">
          Il faut au moins <span className="text-ivory">2 positions</span> avec un historique de cours commun suffisant
          pour calculer la frontière efficiente.
        </p>
      </div>
    );
  }

  const { codes, meanReturns, volatilities, minVarianceWeights, maxSharpeWeights, riskContributions, portfolio } = data;

  return (
    <div className="space-y-6">
      {/* Profil du portefeuille actuel */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Rendement attendu" value={pct(portfolio.ret)} cls={portfolio.ret >= 0 ? 'text-up' : 'text-down'} sub="annualisé" />
        <Kpi label="Volatilité" value={pctAbs(portfolio.vol, 1)} sub="annualisée" />
        <Kpi label="Ratio de Sharpe" value={portfolio.sharpe != null ? portfolio.sharpe.toFixed(2) : '—'} sub="vs sans-risque 6%" />
      </div>

      {/* Allocation actuelle vs cibles */}
      <div tabIndex={0} role="region" aria-label="Tableau, défilement horizontal" className="bg-surface border border-border rounded-xl p-4 overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <h3 className="text-sm font-semibold text-white mb-3">Allocation & rééquilibrage</h3>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted border-b border-border">
            <tr>
              <th className="text-left py-2">Titre</th>
              <th className="text-right py-2">Rdt / Vol</th>
              <th className="text-right py-2">Contrib. risque</th>
              <th className="text-right py-2">Min-variance</th>
              <th className="text-right py-2">Max-Sharpe</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((code, i) => (
              <tr key={code} className="border-b border-border/40">
                <td className="py-2 font-medium text-white">{code}</td>
                <td className="py-2 text-right tabular text-muted">{pct(meanReturns[i])} / {pctAbs(volatilities[i]!, 0)}</td>
                <td className="py-2 text-right tabular text-warn">{pctAbs(riskContributions[i]!, 0)}</td>
                <td className="py-2 text-right tabular text-ivory">{minVarianceWeights ? pctAbs(minVarianceWeights[i]!, 0) : '—'}</td>
                <td className="py-2 text-right tabular text-up">{maxSharpeWeights ? pctAbs(maxSharpeWeights[i]!, 0) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-faint leading-relaxed">
          <span className="text-warn">Contribution au risque</span> : part de la volatilité totale apportée par chaque ligne.
          <span className="text-ivory"> Min-variance</span> : allocation qui minimise le risque.
          <span className="text-up"> Max-Sharpe</span> : allocation qui maximise le rendement par unité de risque.
          Les poids peuvent être négatifs (vente à découvert théorique), à lire comme un écart théorique, pas comme une opération à passer.
          Hypothèses : rendements quotidiens 2 ans, sans-risque 6%.
        </p>
      </div>

      {/* Écart à l'allocation théorique : simulation, pas des ordres (audit lot B) */}
      <RebalancePlan
        codes={codes}
        positions={positions}
        cible={cible}
        setCible={setCible}
        targetWeights={
          cible === 'maxSharpe' ? maxSharpeWeights
            : cible === 'minVariance' ? minVarianceWeights
              : equalWeights(codes.length)
        }
      />
    </div>
  );
}

function RebalancePlan({
  codes, positions, cible, setCible, targetWeights,
}: {
  codes: string[];
  positions: { code: string; value: number; price: number }[];
  cible: Cible;
  setCible: (c: Cible) => void;
  targetWeights: number[] | null;
}) {
  // Aligne les positions sur l'ordre des codes de l'optimiseur.
  const byCode = new Map(positions.map((p) => [p.code, p]));
  const aligned = codes.map((c) => byCode.get(c) ?? { code: c, value: 0, price: 0 });
  const trades = targetWeights ? rebalanceTrades(aligned, targetWeights, 3) : [];
  const aBouger = trades.filter((t) => t.action !== 'conserver');

  const TABS: { id: Cible; label: string }[] = [
    { id: 'maxSharpe', label: 'Max-Sharpe' },
    { id: 'minVariance', label: 'Min-variance' },
    { id: 'equal', label: 'Équipondéré' },
  ];

  return (
    <div tabIndex={0} role="region" aria-label="Tableau, défilement horizontal" className="bg-surface border border-border rounded-xl p-4 overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-white">Écart à l&apos;allocation théorique</h3>
        <div className="flex gap-1 bg-bg/40 rounded-lg p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setCible(t.id)}
              className={`text-xs px-2.5 py-1 rounded-md transition ${cible === t.id ? 'bg-info/15 text-info' : 'text-muted hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {targetWeights == null ? (
        <p className="text-xs text-faint">Allocation cible indisponible pour ce profil.</p>
      ) : aBouger.length === 0 ? (
        <p className="text-xs text-muted">Répartition actuelle proche de l&apos;allocation théorique choisie (écart &lt; 3 %).</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted border-b border-border">
              <tr>
                <th className="text-left py-2">Titre</th>
                <th className="text-right py-2">Actuel → Cible</th>
                <th className="text-right py-2">Dérive</th>
                <th className="text-right py-2">Écart à la cible</th>
                <th className="text-right py-2">Écart en valeur</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.code} className="border-b border-border/40">
                  <td className="py-2 font-medium text-white">{t.code}</td>
                  <td className="py-2 text-right tabular text-muted">{pctAbs(t.currentWeight, 0)} → {pctAbs(t.targetWeight, 0)}</td>
                  <td className={`py-2 text-right tabular ${t.driftPct >= 0 ? 'text-up' : 'text-down'}`}>{t.driftPct >= 0 ? '+' : ''}{t.driftPct.toFixed(1)} pts</td>
                  <td className="py-2 text-right">
                    {/* Écart en nombre de titres, sans verbe ni couleur d'achat/vente :
                        une simulation n'est pas un ordre (audit lot B). */}
                    {t.action === 'conserver' || t.deltaShares === 0
                      ? <span className="text-faint">—</span>
                      : <span className="tabular text-ivory">
                          {t.deltaShares > 0 ? '+' : '−'}{Math.abs(t.deltaShares).toLocaleString('fr-FR')} titres
                        </span>}
                  </td>
                  <td className="py-2 text-right tabular text-ivory">{t.action === 'conserver' ? '—' : fcfa(Math.abs(t.deltaValue))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-faint leading-relaxed">
            Simulation : écart entre votre répartition actuelle et l&apos;allocation théorique choisie
            (<span className="text-info">{TABS.find((x) => x.id === cible)?.label}</span>, sans vente à découvert, tolérance ±3 %,
            nombre de titres arrondi au dernier cours connu). Ce n&apos;est ni un ordre ni une recommandation ;
            WESTBOURSE ne connaît ni votre situation ni vos objectifs.
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="bg-bg/40 border border-border/60 rounded-xl p-4">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`tabular text-lg font-mono font-semibold ${cls ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[11px] text-faint mt-0.5">{sub}</div>}
    </div>
  );
}
