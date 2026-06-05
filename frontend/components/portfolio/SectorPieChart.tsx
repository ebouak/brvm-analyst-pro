'use client';

import { useMemo } from 'react';
import EChart from '@/components/EChart';
import { fmtFcfa, fmtNumber } from '@/lib/format';
import type { Position } from '@/lib/portfolio/queries';
import type { EChartsOption } from 'echarts';

interface Props {
  positions: Position[] | null;
  isLoading?: boolean;
}

/**
 * Sector allocation donut chart.
 * Aggregates portfolio positions by sector, displays top 3 in sidebar,
 * center text shows total portfolio value.
 */
export default function SectorPieChart({ positions, isLoading = false }: Props) {
  // Sector colors (hex)
  const SECTOR_COLORS: Record<string, string> = {
    'Services Financiers': '#01696f',
    'Liquidités': '#006494',
    'Industriels': '#da7101',
    'Consommation de Base': '#437a22',
    'Conso. Discrétionnaire': '#d19900',
    'Energie': '#964219',
    'Télécommunications': '#7a39bb',
  };

  // Default color for unmapped sectors
  const DEFAULT_COLOR = '#8b93a7';

  const chartData = useMemo(() => {
    if (!positions || positions.length === 0) {
      return {
        total: 0,
        items: [],
        topThree: [],
      };
    }

    // Filter out null sectors and aggregate by sector
    const sectorMap: Record<string, number> = {};
    let total = 0;

    for (const pos of positions) {
      if (pos.is_liquidites || !pos.secteur) {
        sectorMap['Liquidités'] = (sectorMap['Liquidités'] ?? 0) + (pos.valeur ?? 0);
      } else {
        sectorMap[pos.secteur] = (sectorMap[pos.secteur] ?? 0) + (pos.valeur ?? 0);
      }
      total += pos.valeur ?? 0;
    }

    // Convert to array and sort by value descending
    const items = Object.entries(sectorMap)
      .map(([sector, value]) => ({
        sector,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      total,
      items,
      topThree: items.slice(0, 3),
    };
  }, [positions]);

  if (isLoading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 h-[300px] flex flex-col">
        <h3 className="text-sm font-semibold mb-3">🥧 Répartition par secteur</h3>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse w-64 h-64 rounded-full bg-elevated"></div>
        </div>
      </div>
    );
  }

  if (!positions || positions.length === 0 || chartData.total === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 h-[300px] flex flex-col items-center justify-center text-muted text-sm">
        <span className="text-2xl mb-2">🥧</span>
        <span>Aucune position</span>
      </div>
    );
  }

  // Build ECharts pie config
  const pieData = chartData.items.map((item) => ({
    name: item.sector,
    value: item.value,
    itemStyle: {
      color: SECTOR_COLORS[item.sector] ?? DEFAULT_COLOR,
    },
  }));

  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number };
        return `
          <div style="color: #e6e9f0; font-size: 12px;">
            <strong>${p.name}</strong><br/>
            ${fmtFcfa(p.value)} FCFA<br/>
            <span style="color: #8b93a7;">${p.percent.toFixed(1)}%</span>
          </div>
        `;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['35%', '60%'], // Donut hole effect
        avoidLabelOverlap: false,
        data: pieData,
        center: ['50%', '50%'],
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: false,
          },
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 2,
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.5)',
          },
        },
      },
    ],
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex gap-4">
      {/* Chart + center text */}
      <div className="flex-1 relative flex items-center justify-center" style={{ height: '300px' }}>
        <EChart height={300} option={option} />

        {/* Center donut text overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-xs text-muted uppercase tracking-wide mb-1">Portefeuille</div>
          <div className="text-lg font-bold tabular">
            {fmtFcfa(chartData.total)} FCFA
          </div>
        </div>
      </div>

      {/* Sidebar: Top 3 sectors */}
      <div className="flex flex-col gap-2 w-40 py-4">
        <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          Top 3 secteurs
        </div>
        {chartData.topThree.length === 0 ? (
          <div className="text-xs text-muted">Aucun secteur</div>
        ) : (
          chartData.topThree.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: SECTOR_COLORS[item.sector] ?? DEFAULT_COLOR,
                }}
              />
              <span className="text-muted flex-1 truncate">{item.sector}</span>
              <span className="text-white font-semibold tabular">
                {item.percentage.toFixed(1)}%
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
