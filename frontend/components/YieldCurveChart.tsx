'use client';
import EChart from './EChart';

export interface CurvePoint { emetteur: string; code: string; x: number; y: number }

const COLORS = ['#00c853', '#42a5f5', '#ffb300', '#7e57c2', '#ef5350', '#26c6da', '#ec407a'];

export default function YieldCurveChart({ data }: { data: CurvePoint[] }) {
  const byEmetteur = data.reduce<Record<string, CurvePoint[]>>((acc, p) => {
    (acc[p.emetteur] ??= []).push(p);
    return acc;
  }, {});

  const groups = Object.entries(byEmetteur).map(([em, pts]) => ({
    em, pts: [...pts].sort((a, b) => a.x - b.x),
  }));

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2">📉 Courbe des taux (YTM vs maturité)</h3>
      <EChart
        height={300}
        option={{
          legend: {
            top: 0, right: 0,
            textStyle: { color: '#8b93a7', fontSize: 11 },
            data: groups.map((g) => g.em),
          },
          xAxis: { type: 'value', name: 'Maturité (ans)', nameLocation: 'end',
            nameTextStyle: { color: '#4a5268', fontSize: 10 },
            axisLabel: { formatter: (v: number) => `${v}a` }, scale: true },
          yAxis: { type: 'value', name: 'YTM %', nameTextStyle: { color: '#4a5268', fontSize: 10 },
            axisLabel: { formatter: (v: number) => `${v.toFixed(1)}%` }, scale: true },
          series: groups.map((g, i) => ({
            name: g.em, type: 'line' as const,
            data: g.pts.map((p) => [p.x, p.y]),
            symbol: 'circle', symbolSize: 8,
            lineStyle: { color: COLORS[i % COLORS.length], width: 1.5 },
            itemStyle: { color: COLORS[i % COLORS.length] },
            tooltip: { formatter: (p: unknown) => {
              const pt = p as { data: [number, number]; seriesName: string };
              return `${pt.seriesName}<br/>Maturité: ${pt.data[0].toFixed(1)} ans<br/>YTM: ${pt.data[1].toFixed(2)}%`;
            } },
          })),
        }}
      />
    </div>
  );
}
