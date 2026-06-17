'use client';

import { useRouter } from 'next/navigation';
import EChart from '@/components/EChart';
import { groupBySector, colorForVariation, nodeWeight } from '@/lib/heatmap';
import type { HeatmapNode } from '@/lib/heatmap';
import { fmtFcfa, fmtNumber } from '@/lib/format';

/** Filtre couleur : toutes, hausses (vert) ou baisses (rouge) uniquement. */
export type ColorFilter = 'all' | 'up' | 'down';

interface Props {
  data: HeatmapNode[];
  height?: number;
  /** Logos par code (chemins /logos/XXX.ext) — affichés dans les tuiles. */
  logos?: Record<string, string | null>;
  /** Filtre couleur appliqué avant le rendu. */
  colorFilter?: ColorFilter;
}

/** Custom fields we embed into each leaf node for tooltip/click access. */
interface LeafExtra {
  code: string;
  designation: string | null;
  variation_pct: number | null;
  cours_jour: number | null;
  volume: number | null;
  capitalisation: number | null;
}

export default function HeatmapTreemap({ data, height = 600, logos = {}, colorFilter = 'all' }: Props) {
  const router = useRouter();

  // Filtre couleur : on retire les tuiles hors-catégorie avant tout regroupement.
  const filtered =
    colorFilter === 'up'
      ? data.filter((n) => (n.variation_pct ?? 0) > 0)
      : colorFilter === 'down'
      ? data.filter((n) => (n.variation_pct ?? 0) < 0)
      : data;

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

  if (!filtered.length) {
    return (
      <div
        className="flex items-center justify-center text-sm rounded-lg"
        style={{ height, color: '#8b93a7', background: '#161922' }}
      >
        {colorFilter === 'up' ? 'Aucune hausse sur cette séance.' : 'Aucune baisse sur cette séance.'}
      </div>
    );
  }

  const sectors = groupBySector(filtered);

  // Build the ECharts treemap data. We cast once at assignment because ECharts'
  // internal TreemapSeriesNodeItemOption is too narrow for our extra fields
  // (custom tooltip data, per-node rich labels with logo images, etc.).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const treemapData: any[] = sectors.map((sector) => ({
    name: sector.name,
    itemStyle: { color: 'transparent', borderColor: '#0f1117', borderWidth: 3 },
    upperLabel: { show: true, color: '#8b93a7', fontSize: 11, fontWeight: 'bold' as const },
    children: sector.children.map((node) => {
      const varStr =
        node.variation_pct != null
          ? `${node.variation_pct >= 0 ? '+' : ''}${node.variation_pct.toFixed(2)}%`
          : '';
      const logoUrl = logos[node.code];

      // Rich label : logo (si dispo) au-dessus du code + variation. Le rich doit
      // être porté par CHAQUE nœud — sinon ECharts affiche le markup brut.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rich: any = {
        code: { color: '#ffffff', fontSize: 12, fontWeight: 'bold', lineHeight: 16 },
        var: { color: '#e6e9f0', fontSize: 10, lineHeight: 14 },
      };
      let formatter = `{code|${node.code}}\n{var|${varStr}}`;
      if (logoUrl) {
        rich.logo = {
          height: 22,
          width: 22,
          align: 'center',
          backgroundColor: { image: logoUrl },
        };
        formatter = `{logo|}\n{code|${node.code}}\n{var|${varStr}}`;
      }

      return {
        name: node.code,
        value: Math.max(nodeWeight(node), 1),
        // Extra fields for tooltip + click handler
        code: node.code,
        designation: node.designation,
        variation_pct: node.variation_pct,
        cours_jour: node.cours_jour,
        volume: node.volume,
        capitalisation: node.capitalisation ?? null,
        itemStyle: { color: colorForVariation(node.variation_pct) },
        label: {
          show: true,
          formatter,
          rich,
          color: '#ffffff',
          overflow: 'truncate' as const,
        },
      };
    }),
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
      d.capitalisation != null
        ? `<div>Capitalisation : <b>${fmtFcfa(d.capitalisation)} FCFA</b></div>`
        : '',
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
            // Leaf level — bordures (le label/rich est porté par chaque nœud).
            itemStyle: { borderColor: '#232733', borderWidth: 1, gapWidth: 1 },
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
