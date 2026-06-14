'use client';
import type { AssetClassPoint, AssetKind } from '@/lib/compare/assetClasses';

let EChartComponent: React.ComponentType<{ option: object; height: number }> | null = null;
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  EChartComponent = require('@/components/EChart').default;
}

const COLOR: Record<AssetKind, string> = {
  marche: '#00c853', dividende: '#d0a231', obligation: '#56d7fd', sans_risque: '#8b93a7',
};

export default function AssetComparisonChart({ points }: { points: AssetClassPoint[] }) {
  const EChart = EChartComponent;
  if (!EChart) return <div className="h-72 bg-surface rounded-xl animate-pulse" />;

  const data = points
    .filter((p) => p.ret != null)
    .map((p) => ({
      name: p.label,
      value: [p.vol != null ? +(p.vol * 100).toFixed(2) : 0, +(p.ret! * 100).toFixed(2)],
      itemStyle: { color: COLOR[p.kind] },
    }));

  const option = {
    backgroundColor: 'transparent',
    grid: { left: 55, right: 24, top: 24, bottom: 44 },
    tooltip: {
      trigger: 'item',
      formatter: (p: { name: string; value: [number, number] }) =>
        `${p.name}<br/>Rendement : ${p.value[1]}%<br/>Risque : ${p.value[0]}%`,
    },
    xAxis: {
      type: 'value', name: 'Risque (volatilité %)', nameLocation: 'middle', nameGap: 28,
      axisLabel: { color: '#8b93a7', fontSize: 10, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#232733' } },
    },
    yAxis: {
      type: 'value', name: 'Rendement %',
      axisLabel: { color: '#8b93a7', fontSize: 10, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#232733' } },
    },
    series: [{
      type: 'scatter', symbolSize: 18, data,
      label: { show: true, position: 'right', color: '#e6e9f0', fontSize: 11, formatter: (p: { name: string }) => p.name },
    }],
  };

  return <EChart option={option} height={300} />;
}
