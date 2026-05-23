'use client';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';

export interface PricePoint {
  date: string;
  close: number | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  volume: number | null;
}

export default function PriceChart({ data }: { data: PricePoint[] }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2">Cours & moyennes mobiles</h3>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#232733" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#8b93a7', fontSize: 10 }} minTickGap={40} />
          <YAxis yAxisId="price" tick={{ fill: '#8b93a7', fontSize: 10 }} domain={['auto', 'auto']} width={56} />
          <YAxis yAxisId="vol" orientation="right" tick={{ fill: '#8b93a7', fontSize: 10 }} width={48} />
          <Tooltip
            contentStyle={{ background: '#161922', border: '1px solid #232733', fontSize: 12 }}
            labelStyle={{ color: '#e6e9f0' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="vol" dataKey="volume" name="Volume" fill="#232733" />
          <Line yAxisId="price" dataKey="close" name="Clôture" stroke="#e6e9f0" dot={false} strokeWidth={1.5} />
          <Line yAxisId="price" dataKey="ma20" name="MA20" stroke="#00c853" dot={false} strokeWidth={1} />
          <Line yAxisId="price" dataKey="ma50" name="MA50" stroke="#ffb300" dot={false} strokeWidth={1} />
          <Line yAxisId="price" dataKey="ma200" name="MA200" stroke="#7e57c2" dot={false} strokeWidth={1} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
