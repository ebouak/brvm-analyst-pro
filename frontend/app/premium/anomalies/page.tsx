import { getAnomaliesData } from '@/lib/premium/anomalies';
import { AnomalieCharts } from '@/components/premium/AnomalieCharts';

export default async function AnomaliesPage() {
  const data = await getAnomaliesData();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <span className="text-[10px] font-semibold text-warn uppercase tracking-widest">Premium</span>
        <h1 className="text-2xl font-bold text-white mt-1">Détection d&apos;Anomalies &amp; Opportunités</h1>
        <p className="text-sm text-muted mt-1">4 analyses visuelles pour identifier les actions hors-norme.</p>
        <div className="flex gap-3 mt-2 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-up inline-block" /> BUY</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warn inline-block" /> HOLD</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-down inline-block" /> SELL</span>
        </div>
      </div>
      <AnomalieCharts {...data} />
    </div>
  );
}
