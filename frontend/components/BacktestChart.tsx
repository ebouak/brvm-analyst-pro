'use client';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';

interface Props {
  equityCurve: { date_index: number; value: number }[];
  closes: number[];
}

export default function BacktestChart({ equityCurve, closes }: Props) {
  if (equityCurve.length === 0 || closes.length === 0) {
    return <div className="text-muted text-sm p-4">Aucune donnée à afficher.</div>;
  }

  const base = closes[0] ?? 1;

  const data = equityCurve.map((pt) => ({
    date_index: pt.date_index,
    strategie: Math.round(pt.value * 100) / 100,
    buyhold: Math.round(100 * ((closes[pt.date_index] ?? base) / base) * 100) / 100,
  }));

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2">Equity curve</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#232733" vertical={false} />
          <XAxis dataKey="date_index" tick={{ fill: '#8b93a7', fontSize: 10 }} minTickGap={40} />
          <YAxis tick={{ fill: '#8b93a7', fontSize: 10 }} domain={['auto', 'auto']} width={56} />
          <Tooltip
            contentStyle={{ background: '#161922', border: '1px solid #232733', fontSize: 12 }}
            labelStyle={{ color: '#e6e9f0' }}
            formatter={(v: number) => [`${v.toFixed(2)}`, undefined]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line dataKey="strategie" name="Stratégie" stroke="#00c853" dot={false} strokeWidth={1.5} />
          <Line dataKey="buyhold" name="Buy & Hold" stroke="#ffb300" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
