'use client';
import { useState } from 'react';
import EChart from '@/components/EChart';
import { normalizeBase100 } from '@/lib/reportUtils';

export interface PriceSeries {
  code: string;
  dates: string[];
  closes: (number | null)[];
}

const COLORS = ['#00c853', '#ffb300', '#2979ff', '#e040fb', '#ff6d00', '#00bcd4'];

interface Props {
  series: PriceSeries[];
}

type Mode = 'prix' | 'base100';

export default function MultiPriceChart({ series }: Props) {
  const [mode, setMode] = useState<Mode>('prix');

  if (series.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-5 text-center text-muted text-sm">
        Aucun cours à afficher.
      </div>
    );
  }

  const allDates = [...new Set(series.flatMap((s) => s.dates))].sort();

  const seriesData = series.map((s) => {
    const closes = mode === 'base100' ? normalizeBase100(s.closes) : s.closes;
    return allDates.map((date) => {
      const idx = s.dates.indexOf(date);
      return idx === -1 ? null : (closes[idx] ?? null);
    });
  });

  return (
    <section className="bg-surface border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Évolution des cours</h2>
        <div className="flex gap-1">
          {(['prix', 'base100'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`text-xs px-3 py-1 rounded border transition ${
                mode === m
                  ? 'border-up text-up'
                  : 'border-border text-muted hover:border-up/40'
              }`}
            >
              {m === 'prix' ? 'Prix' : 'Base 100'}
            </button>
          ))}
        </div>
      </div>

      <EChart
        height={320}
        option={{
          legend: {
            top: 0, right: 0,
            textStyle: { color: '#8b93a7', fontSize: 11 },
            data: series.map((s) => s.code),
          },
          xAxis: {
            type: 'category',
            data: allDates,
            boundaryGap: false,
            axisLabel: { color: '#8b93a7', fontSize: 10, interval: Math.floor(allDates.length / 6), rotate: 30 },
          },
          yAxis: {
            type: 'value',
            scale: true,
            axisLabel: {
              formatter: (v: number) =>
                mode === 'base100' ? v.toFixed(0) : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v),
            },
          },
          dataZoom: [
            { type: 'inside', start: 0, end: 100 },
            {
              type: 'slider', height: 20, bottom: 0,
              borderColor: '#232733',
              fillerColor: 'rgba(0,200,83,0.08)',
              handleStyle: { color: '#00c853' },
              textStyle: { color: '#4a5268', fontSize: 9 },
            },
          ],
          series: series.map((s, i) => ({
            name: s.code,
            type: 'line' as const,
            data: seriesData[i],
            symbol: 'none',
            connectNulls: true,
            lineStyle: { color: COLORS[i % COLORS.length], width: 1.5 },
            itemStyle: { color: COLORS[i % COLORS.length] },
          })),
        }}
      />
    </section>
  );
}
