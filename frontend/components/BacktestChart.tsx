'use client';
import EChart from './EChart';

interface Props {
  equityCurve: { date_index: number; date?: string; value: number }[];
  closes: number[];
  dates?: string[];
  drawdownPeriods?: { start: number; end: number }[];
}

export default function BacktestChart({ equityCurve, closes, dates, drawdownPeriods }: Props) {
  if (equityCurve.length === 0 || closes.length === 0) {
    return <div className="text-muted text-sm p-4">Aucune donnée à afficher.</div>;
  }

  const base = closes[0] ?? 1;

  const labels    = equityCurve.map((pt) => pt.date ?? dates?.[pt.date_index] ?? String(pt.date_index));
  const strategie = equityCurve.map((pt) => +(pt.value.toFixed(2)));
  const buyhold   = equityCurve.map((pt) => +(100 * ((closes[pt.date_index] ?? base) / base)).toFixed(2));

  // Zones de drawdown en markArea
  const markAreas = (drawdownPeriods ?? []).map((d) => [
    { xAxis: labels[d.start] ?? String(d.start) },
    { xAxis: labels[Math.min(d.end, labels.length - 1)] ?? String(d.end) },
  ] as [{ xAxis: string }, { xAxis: string }]);

  return (
    <div className="bg-surface border border-border rounded-xl p-4 min-h-[420px]">
      <h3 className="text-sm font-semibold mb-2">📈 Courbe d&apos;équité</h3>
      <EChart
        height={380}
        option={{
          legend: {
            top: 0, right: 0,
            textStyle: { color: '#8b93a7', fontSize: 11 },
            data: ['Stratégie', 'Buy & Hold'],
          },
          xAxis: {
            type: 'category', data: labels, boundaryGap: false,
            axisLabel: { color: '#8b93a7', fontSize: 10,
              interval: Math.floor(labels.length / 6), rotate: 30 },
          },
          yAxis: { type: 'value', scale: true,
            axisLabel: { formatter: (v: number) => v.toFixed(0) } },
          dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            { type: 'slider', height: 20, bottom: 0, borderColor: '#232733',
              fillerColor: 'rgba(0,200,83,0.08)', handleStyle: { color: '#00c853' },
              textStyle: { color: '#4a5268', fontSize: 9 } },
          ],
          series: [
            {
              name: 'Stratégie', type: 'line', data: strategie,
              symbol: 'none', lineStyle: { color: '#00c853', width: 2 },
              areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [{ offset: 0, color: 'rgba(0,200,83,0.15)' }, { offset: 1, color: 'transparent' }] } },
              markArea: markAreas.length > 0 ? {
                silent: true,
                itemStyle: { color: 'rgba(244,67,54,0.12)' },
                data: markAreas,
              } : undefined,
            },
            {
              name: 'Buy & Hold', type: 'line', data: buyhold,
              symbol: 'none', lineStyle: { color: '#8b93a7', width: 1.5, type: 'dashed' },
            },
          ],
        }}
      />
    </div>
  );
}
