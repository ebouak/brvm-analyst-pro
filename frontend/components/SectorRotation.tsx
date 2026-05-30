'use client';

import EChart from '@/components/EChart';
import { quadrant } from '@/lib/sectors';
import type { SectorPerf } from '@/lib/sectors';
import type { EChartsOption } from 'echarts';

interface Props {
  perfs: SectorPerf[];
}

const QUADRANT_COLORS: Record<string, string> = {
  leading: '#00c853',
  improving: '#ffb300',
  weakening: '#42a5f5',
  lagging: '#f44336',
};

const QUADRANT_LABELS: Record<string, string> = {
  leading: 'Leading',
  improving: 'Improving',
  weakening: 'Weakening',
  lagging: 'Lagging',
};

export default function SectorRotation({ perfs }: Props) {
  const validPerfs = perfs.filter((p) => p.var30d != null && p.var90d != null);

  if (validPerfs.length === 0) {
    return (
      <div
        className="rounded-lg p-8 text-center text-[#8b93a7]"
        style={{ background: '#161922', border: '1px solid #232733' }}
      >
        Données insuffisantes pour le graphique de rotation.
      </div>
    );
  }

  const maxVol = Math.max(...validPerfs.map((p) => p.volumeDay), 1);

  const data = validPerfs.map((p) => {
    const q = quadrant(p.var30d, p.var90d) ?? 'lagging';
    const size = Math.max(10, (p.volumeDay / maxVol) * 50);
    return {
      name: p.secteur,
      value: [p.var30d, p.var90d, size],
      quadrant: q,
      itemStyle: { color: QUADRANT_COLORS[q] },
    };
  });

  const option: EChartsOption = {
    grid: { top: 48, right: 48, bottom: 56, left: 64, containLabel: true },
    tooltip: {
      formatter: (params: unknown) => {
        const p = params as { name: string; value: [number, number, number]; data: { quadrant: string } };
        const q = p.data.quadrant;
        return [
          `<b style="color:#e6e9f0">${p.name}</b>`,
          `Var 30j : <b>${(p.value[0] ?? 0).toFixed(2)}%</b>`,
          `Var 90j : <b>${(p.value[1] ?? 0).toFixed(2)}%</b>`,
          `Quadrant : <span style="color:${QUADRANT_COLORS[q]}">${QUADRANT_LABELS[q]}</span>`,
        ].join('<br/>');
      },
    },
    xAxis: {
      type: 'value',
      name: 'Var 30j (%)',
      nameLocation: 'middle',
      nameGap: 32,
      nameTextStyle: { color: '#8b93a7', fontSize: 11 },
      axisLine: { lineStyle: { color: '#232733' } },
      axisLabel: {
        color: '#8b93a7',
        fontSize: 11,
        formatter: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'Var 90j (%)',
      nameLocation: 'middle',
      nameGap: 48,
      nameTextStyle: { color: '#8b93a7', fontSize: 11 },
      axisLine: { show: false },
      axisLabel: {
        color: '#8b93a7',
        fontSize: 11,
        formatter: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
      },
      splitLine: { lineStyle: { color: '#232733', type: 'dashed' } },
    },
    series: [
      // Lignes de quadrant x=0
      {
        type: 'line' as const,
        data: [] as [],
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#4a5268', type: 'dashed', width: 1 },
          data: [{ xAxis: 0 }, { yAxis: 0 }],
          label: { show: false },
        },
      },
      // Bulles
      {
        type: 'scatter' as const,
        data: data as unknown as [],
        symbolSize: (val: unknown) => {
          const v = val as [number, number, number];
          return v[2] ?? 16;
        },
        label: {
          show: true,
          formatter: '{b}',
          position: 'top',
          color: '#e6e9f0',
          fontSize: 10,
        },
        emphasis: {
          scale: true,
          label: { show: true, fontWeight: 'bold' },
        },
      },
    ],
    graphic: [
      makeQuadrantLabel('Leading', '#00c853', '95%', '5%'),
      makeQuadrantLabel('Improving', '#ffb300', '95%', '95%'),
      makeQuadrantLabel('Weakening', '#42a5f5', '5%', '5%'),
      makeQuadrantLabel('Lagging', '#f44336', '5%', '95%'),
    ],
  };

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: '#161922', border: '1px solid #232733' }}
    >
      <h3 className="text-sm font-semibold text-[#e6e9f0] mb-1">Rotation sectorielle</h3>
      <p className="text-xs text-[#8b93a7] mb-4">
        X = Var 30j · Y = Var 90j · taille bulle = volume journalier
      </p>
      <EChart option={option} height={460} />
    </div>
  );
}

function makeQuadrantLabel(
  text: string,
  color: string,
  right: string,
  bottom: string,
) {
  return {
    type: 'text',
    right,
    bottom,
    style: {
      text,
      fill: color,
      fontSize: 11,
      fontWeight: 'bold',
      opacity: 0.5,
    },
  };
}
