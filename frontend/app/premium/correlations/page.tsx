import { getCorrelationsData } from '@/lib/premium/correlations';
import CorrelationsCharts from '@/components/premium/CorrelationsCharts';

export const revalidate = 3600;

export default async function CorrelationsPage() {
  const series = await getCorrelationsData();

  const maxCorr = series.reduce((best, s) => (Math.abs(s.coefficient) > Math.abs(best.coefficient) ? s : best), series[0] ?? { label: '—', coefficient: 0 });
  const avgCorr = series.length > 0 ? series.reduce((s, c) => s + Math.abs(c.coefficient), 0) / series.length : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Corrélation Matières Premières</h1>
        <p className="text-muted text-sm mt-1">
          Relation entre le cours des actions BRVM et les matières premières sous-jacentes (huile de palme, caoutchouc, sucre, cacao)
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Secteurs analysés</div>
          <div className="text-3xl font-bold text-info tabular">{series.length}</div>
          <div className="text-xs text-muted mt-1">filières agro-industrielles BRVM</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Plus forte corrélation</div>
          <div className="text-2xl font-bold text-up tabular">
            {maxCorr.coefficient >= 0 ? '+' : ''}{maxCorr.coefficient.toFixed(2)}
          </div>
          <div className="text-xs text-muted mt-1 truncate">{maxCorr.label?.split('(')[0]?.trim()}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs text-muted uppercase tracking-wider mb-1">Corrélation moyenne</div>
          <div className="text-3xl font-bold text-warn tabular">{avgCorr.toFixed(2)}</div>
          <div className="text-xs text-muted mt-1">sur 52 semaines</div>
        </div>
      </div>

      {/* Main charts */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <CorrelationsCharts series={series} />
      </div>
    </div>
  );
}
