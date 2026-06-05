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
 * Bar chart showing monthly portfolio performance.
 *
 * - Green bar (#437a22): positive performance
 * - Red bar (#a12c7b): negative performance
 * - Value labels above/below bars ("+6.47%" / "-2.15%")
 * - Tooltip: "Janvier 2026 : +6.47% | Valeur : 1 714 623 FCFA"
 * - Height: 260px
 * - Responsive: width 100%
 * - X-axis: month (jan. 26, fév. 26)
 * - Y-axis: percentage (0 to max)
 * - Loading skeleton
 * - Empty state: "Aucune donnée"
 */
export default function MonthlyPerfChart({ data, isLoading = false }: Props) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        months: [],
        performances: [],
        values: [],
      };
    }

    // Sort by date ascending for chart display
    const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const months: string[] = [];
    const performances: Array<{
      value: number;
      itemStyle: { color: string; borderColor?: string };
    }> = [];
    const values: number[] = [];

    for (const entry of sorted) {
      const date = new Date(entry.date);
      const monthName = date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      months.push(monthName);

      const perf = entry.performance_mensuelle ?? 0;
      const perfPercent = perf * 100; // Convert decimal to percentage

      // Green for positive (#437a22), Red for negative (#a12c7b)
      const isPositive = perfPercent >= 0;
      const barColor = isPositive ? '#437a22' : '#a12c7b';
      const darkerShade = isPositive ? '#2d5516' : '#7a1e5a'; // darker shade for stroke

      performances.push({
        value: perfPercent,
        itemStyle: {
          color: barColor,
          borderColor: darkerShade,
        },
      });

      values.push(entry.valeur_finale ?? 0);
    }

    return {
      months,
      performances,
      values,
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
          axisValueLabel: string;
          dataIndex: number;
        }>;

        if (!Array.isArray(p) || p.length === 0) return '';

        const monthLabel = p[0].axisValueLabel;
        const dataIndex = p[0].dataIndex;
        const perfValue = chartData.performances[dataIndex]?.value ?? 0;
        const portfolioValue = chartData.values[dataIndex] ?? 0;

        const sign = perfValue >= 0 ? '+' : '';
        const html = `<div style="color: #e6e9f0; font-size: 12px;"><strong>${monthLabel}</strong><br/>
          Performance : ${sign}${perfValue.toFixed(2)}%<br/>
          <strong style="color: ${perfValue >= 0 ? '#437a22' : '#a12c7b'};">Valeur : ${fmtFcfa(portfolioValue)} FCFA</strong>
        </div>`;

        return html;
      },
    },
    grid: {
      top: 20,
      right: 40,
      bottom: 40,
      left: 40,
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
    yAxis: {
      type: 'value',
      name: 'Performance (%)',
      axisLine: { show: false },
      axisLabel: {
        color: '#8b93a7',
        fontSize: 11,
        formatter: (value: number) => `${value.toFixed(0)}%`,
      },
      splitLine: { lineStyle: { color: '#232733', type: 'dashed' } },
    },
    series: [
      {
        name: 'Performance Mensuelle',
        type: 'bar',
        data: chartData.performances,
        barMaxWidth: 32,
        itemStyle: {
          borderWidth: 1,
          borderRadius: [4, 4, 0, 0],
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        label: {
          show: true,
          position: ((p: unknown) => ((p as any).value ?? 0) >= 0 ? 'top' : 'bottom') as any,
          formatter: (p: unknown) => {
            const val = (p as { value: number }).value ?? 0;
            const sign = val >= 0 ? '+' : '';
            return `${sign}${val.toFixed(2)}%`;
          },
          color: '#e6e9f0',
          fontSize: 12,
          fontWeight: 'bold',
        },
        markLine: {
          silent: true,
          data: [{ yAxis: 0 }],
          lineStyle: { color: '#8b93a7', width: 1 },
          label: { show: false },
        },
      },
    ],
  };

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
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-4 text-up">📈 Performance Mensuelle (%)</h3>
      <EChart option={option} height={260} />
    </div>
  );
}
