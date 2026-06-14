'use client';

import { usePortfolioOptimizer } from '@/lib/portfolio/useOptimizer';

const pct = (v: number | null | undefined, d = 1) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`);
const pctAbs = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;

/** Optimiseur Markowitz : allocation actuelle vs min-variance / max-Sharpe + rééquilibrage. */
export default function PortfolioOptimizer({ userId }: { userId: string }) {
  const { data, isLoading, insufficient } = usePortfolioOptimizer(userId);

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
      <div className="bg-surface border border-border rounded-xl p-4 overflow-x-auto">
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
          Les poids peuvent être négatifs (vente à découvert théorique) — à interpréter comme une direction de rééquilibrage.
          Hypothèses : rendements quotidiens 2 ans, sans-risque 6%.
        </p>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="bg-bg/40 border border-border/60 rounded-xl p-4">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`tabular text-lg font-mono font-semibold ${cls ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-faint mt-0.5">{sub}</div>}
    </div>
  );
}
