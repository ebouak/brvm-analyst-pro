'use client';
import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
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

  // Build unified date index.
  const allDates = [...new Set(series.flatMap((s) => s.dates))].sort();

  const chartData = allDates.map((date) => {
    const point: Record<string, string | number | null> = { date };
    for (const s of series) {
      const idx = s.dates.indexOf(date);
      if (idx === -1) {
        point[s.code] = null;
      } else {
        const closes =
          mode === 'base100' ? normalizeBase100(s.closes) : s.closes;
        point[s.code] = closes[idx] ?? null;
      }
    }
    return point;
  });

  return (
    <section className="bg-surface border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Évolution des cours</h2>
        <div className="flex gap-1">
          {(['prix', 'base100'] as Mode[]).map((m) => (
            <button
              key={m}
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

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#232733" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#8b93a7', fontSize: 10 }}
            minTickGap={40}
          />
          <YAxis
            tick={{ fill: '#8b93a7', fontSize: 10 }}
            domain={['auto', 'auto']}
            width={56}
          />
          <Tooltip
            contentStyle={{ background: '#161922', border: '1px solid #232733', fontSize: 12 }}
            labelStyle={{ color: '#e6e9f0' }}
            formatter={(v: number) => v.toFixed(2)}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s, i) => (
            <Line
              key={s.code}
              dataKey={s.code}
              stroke={COLORS[i % COLORS.length]}
              dot={false}
              strokeWidth={1.5}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
