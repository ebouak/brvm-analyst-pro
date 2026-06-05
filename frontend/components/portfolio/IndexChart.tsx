'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { MonthlyTrackingEntry } from '@/lib/portfolio/queries';

interface Props {
  data: MonthlyTrackingEntry[] | null;
  isLoading?: boolean;
}

/**
 * Line chart showing portfolio index evolution (base 100).
 * Last 12+ months of portfolio_monthly_tracking.
 *
 * - Smooth monotone curves
 * - Gradient fill with 0.15 opacity
 * - Reference line at Y=100 with label "Départ (100)"
 * - Annotation showing total gain if positive
 * - Height 260px, responsive width
 * - Handles empty states and loading
 */
export default function IndexChart({ data, isLoading = false }: Props) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        entries: [],
        gain: null,
        gainPercent: null,
        firstValue: 100,
        lastValue: 100,
      };
    }

    // Sort by date ascending to ensure chronological order
    const sorted = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Format entries for chart
    const entries = sorted.map((entry) => {
      const date = new Date(entry.date);
      // Format as "jan. 26", "fév. 26", etc.
      const monthName = date.toLocaleDateString('fr-FR', {
        month: 'short',
        year: '2-digit',
      });

      return {
        month: monthName,
        indice_base100: entry.indice_base100 ?? 100,
        date: entry.date,
      };
    });

    const firstValue = entries[0]?.indice_base100 ?? 100;
    const lastValue = entries[entries.length - 1]?.indice_base100 ?? 100;
    const gainPercent = ((lastValue - 100) / 100) * 100;
    const gain = lastValue - firstValue;

    return {
      entries,
      gain,
      gainPercent,
      firstValue,
      lastValue,
    };
  }, [data]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-elevated rounded animate-pulse w-48" />
        <div className="h-64 bg-elevated rounded animate-pulse" />
      </div>
    );
  }

  // Empty state
  if (!data || data.length === 0 || chartData.entries.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-muted rounded-lg bg-surface border border-border">
        Aucune donnée
      </div>
    );
  }

  const isGain = chartData.gainPercent !== null && chartData.gainPercent > 0;
  const gainSign = isGain ? '+' : '';

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
      {/* Header with title and gain annotation */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">📈 Évolution de l'indice</h3>
        {isGain && chartData.gainPercent !== null && (
          <span className="text-sm font-semibold text-up">
            {gainSign}{chartData.gainPercent.toFixed(1)}% depuis le début
          </span>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={chartData.entries}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <defs>
            <linearGradient id="colorIndice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#01696f" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#01696f" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#232733"
            vertical={false}
          />

          <XAxis
            dataKey="month"
            stroke="#8b93a7"
            style={{ fontSize: 11 }}
            tick={{ fill: '#8b93a7' }}
          />

          <YAxis
            stroke="#8b93a7"
            style={{ fontSize: 11 }}
            tick={{ fill: '#8b93a7' }}
            domain={['dataMin - 5', 'dataMax + 5']}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: '#161922',
              border: '1px solid #232733',
              borderRadius: '6px',
              color: '#e6e9f0',
            }}
            labelStyle={{ color: '#8b93a7' }}
            formatter={(value: number) => [
              value.toFixed(2),
              'Indice base 100',
            ]}
          />

          <Legend
            wrapperStyle={{ paddingTop: '12px' }}
            iconType="line"
          />

          {/* Reference line at 100 */}
          <ReferenceLine
            y={100}
            stroke="#8b93a7"
            strokeDasharray="5 5"
            label={{
              value: 'Départ (100)',
              position: 'right',
              fill: '#8b93a7',
              fontSize: 11,
            }}
          />

          {/* Main line: smooth monotone curve with gradient fill */}
          <Line
            type="monotone"
            dataKey="indice_base100"
            stroke="#01696f"
            strokeWidth={2}
            dot={false}
            fill="url(#colorIndice)"
            isAnimationActive={false}
            name="Indice"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
