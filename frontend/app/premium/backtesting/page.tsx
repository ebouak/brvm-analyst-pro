import { getBacktestingData } from '@/lib/premium/backtesting';
import { BacktestingTables } from '@/components/premium/BacktestingTables';

export default async function BacktestingPremiumPage() {
  const data = await getBacktestingData();

  const nbActions = data.topPlusValues.length;
  const bestPv = data.topPlusValuesPct[0];
  const bestDiv = data.topDividendesTotal[0];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <span className="text-[10px] font-semibold text-warn uppercase tracking-widest">Premium</span>
        <h1 className="text-2xl font-bold text-white mt-1">Backtesting Historique</h1>
        <p className="text-sm text-muted mt-1">Classement des meilleures performances et dividendes historiques sur la BRVM.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-faint uppercase tracking-wider mb-1">Actions analysées</p>
          <p className="text-2xl font-bold text-white tabular">{nbActions}</p>
        </div>
        {bestPv && (
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-faint uppercase tracking-wider mb-1">Meilleure performance</p>
            <p className="text-xl font-bold text-up tabular">+{bestPv.performance_pct.toFixed(1)}%</p>
            <p className="text-xs text-muted mt-0.5">{bestPv.code} — {bestPv.designation}</p>
          </div>
        )}
        {bestDiv && (
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-faint uppercase tracking-wider mb-1">Meilleur payeur dividendes</p>
            <p className="text-xl font-bold text-accent tabular">{bestDiv.code}</p>
            <p className="text-xs text-muted mt-0.5">{bestDiv.total_divs.toLocaleString('fr-FR')} FCFA cumulés</p>
          </div>
        )}
      </div>

      <BacktestingTables data={data} />
    </div>
  );
}
