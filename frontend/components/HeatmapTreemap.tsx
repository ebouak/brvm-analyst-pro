'use client';

import { useRouter } from 'next/navigation';
import EChart from '@/components/EChart';
import { groupBySector, colorForVariation } from '@/lib/heatmap';
import type { HeatmapNode } from '@/lib/heatmap';
import { fmtFcfa, fmtNumber } from '@/lib/format';

interface Props {
  data: HeatmapNode[];
  height?: number;
}

/** Custom fields we embed into each leaf node for tooltip/click access. */
interface LeafExtra {
  code: string;
  designation: string | null;
  variation_pct: number | null;
  cours_jour: number | null;
  volume: number | null;
}

export default function HeatmapTreemap({ data, height = 600 }: Props) {
  const router = useRouter();

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-sm rounded-lg"
        style={{ height, color: '#8b93a7', background: '#161922' }}
      >
        Pas de séance disponible
      </div>
    );
  }

  const sectors = groupBySector(data);

  // Build the ECharts treemap data. We cast once at assignment because ECharts'
  // internal TreemapSeriesNodeItemOption is too narrow for our extra fields
  // (custom tooltip data, rich-label overflow literal union, etc.).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const treemapData: any[] = sectors.map((sector) => ({
    name: sector.name,
    itemStyle: { color: 'transparent', borderColor: '#0f1117', borderWidth: 3 },
    upperLabel: { show: true, color: '#8b93a7', fontSize: 11, fontWeight: 'bold' as const },
    children: sector.children.map((node) => ({
      name: node.code,
      value: Math.max(node.valeur_echangee ?? 1, 1),
      // Extra fields for tooltip + click handler
      code: node.code,
      designation: node.designation,
      variation_pct: node.variation_pct,
      cours_jour: node.cours_jour,
      volume: node.volume,
      itemStyle: { color: colorForVariation(node.variation_pct) },
      label: {
        show: true,
        formatter: () => {
          const varStr =
            node.variation_pct != null
              ? `${node.variation_pct >= 0 ? '+' : ''}${node.variation_pct.toFixed(2)}%`
              : '';
          return `{code|${node.code}}\n{var|${varStr}}`;
        },
        color: '#ffffff',
        fontSize: 11,
        overflow: 'truncate' as const,
      },
    })),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipFormatter = (params: any): string => {
    const d = params?.data as (LeafExtra & { name: string }) | undefined;
    if (!d?.code) return (params?.name as string) ?? '';
    const varVal = d.variation_pct;
    const varColor = varVal != null && varVal >= 0 ? '#00c853' : '#f44336';
    const varStr =
      varVal != null
        ? `<span style="color:${varColor};font-weight:600">${varVal >= 0 ? '+' : ''}${varVal.toFixed(2)}%</span>`
        : '—';
    return [
      `<div style="padding:4px 2px">`,
      `<div style="font-weight:700;font-size:13px;color:#e6e9f0">${d.code}</div>`,
      `<div style="color:#8b93a7;font-size:11px;margin-bottom:6px">${d.designation ?? ''}</div>`,
      `<div>Prix : <b>${fmtFcfa(d.cours_jour)} FCFA</b></div>`,
      `<div>Variation : ${varStr}</div>`,
      `<div>Volume : <b>${fmtNumber(d.volume ?? 0)}</b> titres</div>`,
      `</div>`,
    ].join('');
  };

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: '#161922',
      borderColor: '#232733',
      borderWidth: 1,
      textStyle: { color: '#e6e9f0', fontSize: 12 },
      formatter: tooltipFormatter,
    },
    series: [
      {
        type: 'treemap' as const,
        data: treemapData,
        width: '100%',
        height: '100%',
        top: 0,
        left: 0,
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        levels: [
          {
            // Sector level
            itemStyle: { borderColor: '#0f1117', borderWidth: 3, gapWidth: 3 },
            upperLabel: {
              show: true,
              height: 22,
              color: '#8b93a7',
              fontSize: 11,
              fontWeight: 'bold' as const,
              backgroundColor: 'rgba(15,17,23,0.7)',
              padding: [3, 6] as [number, number],
            },
          },
          {
            // Leaf level
            itemStyle: { borderColor: '#232733', borderWidth: 1, gapWidth: 1 },
            label: {
              rich: {
                code: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' as const, lineHeight: 18 },
                var: { color: '#e6e9f0', fontSize: 10, lineHeight: 14 },
              },
            },
          },
        ],
      },
    ],
  };

  const onEvents = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    click: (params: any) => {
      const code = params?.data?.code as string | undefined;
      if (code) router.push(`/actions/${code}`);
    },
  };

  return (
    <EChart
      // Cast needed: EChartsOption's series union doesn't accommodate our
      // custom treemap node fields; the runtime shape is fully valid.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      option={option as any}
      height={height}
      onEvents={onEvents}
      className="w-full"
    />
  );
}
