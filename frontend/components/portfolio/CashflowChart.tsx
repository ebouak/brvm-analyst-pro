'use client';

import { useMemo } from 'react';
import EChart from '@/components/EChart';
import { fmtFcfa } from '@/lib/format';
import type { MonthlyTrackingEntry } from '@/lib/portfolio/queries';
import type { EChartsOption } from 'echarts';

interface Props {
  data: MonthlyTrackingEntry[] | null;
  isLoading?: boolean;
}

/**
 * Grouped bar chart showing monthly apports (contributions) and retraits (withdrawals)
 * with cumulative net flow line overlay on secondary Y-axis.
 *
 * - Blue bar (#006494): apports
 * - Orange bar (#da7101): retraits (displayed as negative)
 * - Dashed cumulative net flow line (primary color) on right Y-axis
 * - KPI summary above chart
 * - Responsive, 260px height
 */
export default function CashflowChart({ data, isLoading = false }: Props) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        months: [],
        apports: [],
        retraits: [],
        cumulativeNetFlow: [],
        cumulativePercent: [],
        totalApports: 0,
        totalRetraits: 0,
        netFlow: 0,
      };
    }

    // Sort by date ascending
    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const months: string[] = [];
    const apports: number[] = [];
    const retraits: number[] = [];
    const cumulativeNetFlow: number[] = [];
    let cumulative = 0;

    for (const entry of sorted) {
      const date = new Date(entry.date);
      const monthName = date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
      months.push(monthName);

      const apport = entry.apports ?? 0;
      const retrait = entry.retraits ?? 0;

      apports.push(apport);
      retraits.push(retrait);

      cumulative += apport - retrait;
      cumulativeNetFlow.push(cumulative);
    }

    const totalApports = apports.reduce((sum, a) => sum + a, 0);
    const totalRetraits = retraits.reduce((sum, r) => sum + r, 0);
    const netFlow = totalApports - totalRetraits;

    // Normalize cumulative flow to percentage (0-100%) for right Y-axis
    const maxCumulative = Math.max(...cumulativeNetFlow, Math.abs(Math.min(...cumulativeNetFlow)));
    const cumulativePercent = cumulativeNetFlow.map(v => {
      if (maxCumulative === 0) return 0;
      return (v / maxCumulative) * 100;
    });

    return {
      months,
      apports,
      retraits,
      cumulativeNetFlow,
      cumulativePercent,
      totalApports,
      totalRetraits,
      netFlow,
    };
  }, [data]);

  const option: EChartsOption = {
    title: {
      show: false,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const p = params as Array<{
          name: string;
          value: number;
          seriesName: string;
          axisValueLabel: string;
        }>;

        if (!Array.isArray(p) || p.length === 0) return '';

        const monthLabel = p[0].axisValueLabel;
        let html = `<div style="color: #e6e9f0; font-size: 12px;"><strong>${monthLabel}</strong><br/>`;

        for (const item of p) {
          let label = item.seriesName;
          let value = item.value;

          if (item.seriesName === 'Retraits') {
            // Show retraits as positive in tooltip even though displayed as negative
            html += `${label} : ${fmtFcfa(Math.abs(value))} FCFA<br/>`;
          } else if (item.seriesName === 'Apports') {
            html += `${label} : ${fmtFcfa(value)} FCFA<br/>`;
          }
        }

        // Add net flow for this month
        if (chartData.months.length > 0) {
          const monthIdx = chartData.months.findIndex(m => m === monthLabel);
          if (monthIdx !== -1) {
            const apport = chartData.apports[monthIdx];
            const retrait = chartData.retraits[monthIdx];
            const monthNet = apport - retrait;
            const sign = monthNet >= 0 ? '+' : '';
            html += `<strong style="color: #006494;">Net : ${sign}${fmtFcfa(monthNet)} FCFA</strong>`;
          }
        }

        html += '</div>';
        return html;
      },
    },
    grid: {
      top: 20,
      right: 60,
      bottom: 40,
      left: 56,
      containLabel: false,
    },
    xAxis: {
      type: 'category',
      data: chartData.months,
      boundaryGap: true,
      axisLine: { lineStyle: { color: '#232733' } },
      axisLabel: { color: '#8b93a7', fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: 'FCFA',
        position: 'left',
        axisLine: { show: false },
        axisLabel: {
          color: '#8b93a7',
          fontSize: 11,
          formatter: (value: number) => fmtFcfa(value),
        },
        splitLine: { lineStyle: { color: '#232733', type: 'dashed' } },
      },
      {
        type: 'value',
        name: 'Flux Cumulé (%)',
        position: 'right',
        axisLine: { show: false },
        axisLabel: {
          color: '#8b93a7',
          fontSize: 11,
          formatter: (value: number) => `${value.toFixed(0)}%`,
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Apports',
        type: 'bar',
        data: chartData.apports,
        itemStyle: { color: '#006494' },
        yAxisIndex: 0,
      },
      {
        name: 'Retraits',
        type: 'bar',
        data: chartData.retraits.map(r => -r),
        itemStyle: { color: '#da7101' },
        yAxisIndex: 0,
      },
      {
        name: 'Flux Cumulé',
        type: 'line',
        data: chartData.cumulativeNetFlow,
        smooth: true,
        lineStyle: {
          color: '#006494',
          type: 'dashed',
          width: 2,
        },
        itemStyle: { color: '#006494' },
        yAxisIndex: 1,
        showSymbol: false,
        symbolSize: 4,
      },
    ],
  };

  // KPI section
  const netFlowColor = chartData.netFlow >= 0 ? 'text-up' : 'text-down';
  const netFlowSign = chartData.netFlow >= 0 ? '+' : '';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-elevated rounded animate-pulse w-96" />
        <div className="h-64 bg-elevated rounded animate-pulse" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-muted rounded-lg bg-surface border border-border">
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Summary */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col">
            <span className="text-xs text-muted uppercase tracking-wide mb-2">Total Apports</span>
            <span className="text-2xl font-bold tabular text-up">{fmtFcfa(chartData.totalApports)} FCFA</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted uppercase tracking-wide mb-2">Total Retraits</span>
            <span className="text-2xl font-bold tabular text-down">{fmtFcfa(chartData.totalRetraits)} FCFA</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted uppercase tracking-wide mb-2">Flux Net</span>
            <span className={`text-2xl font-bold tabular ${netFlowColor}`}>
              {netFlowSign}{fmtFcfa(chartData.netFlow)} FCFA
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <EChart option={option} height={260} />
    </div>
  );
}
