'use client';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const COLORS = ['#00c853', '#42a5f5', '#ffb300', '#7e57c2', '#ef5350', '#26c6da'];

export interface ComparePoint {
  date: string;
  [code: string]: number | string | null;
}

export default function CompareChart({
  data,
  codes,
}: {
  data: ComparePoint[];
  codes: string[];
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2">Performance comparée (base 100)</h3>
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#232733" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#8b93a7', fontSize: 10 }} minTickGap={40} />
          <YAxis tick={{ fill: '#8b93a7', fontSize: 10 }} width={44} domain={['auto', 'auto']} />
          <Tooltip contentStyle={{ background: '#161922', border: '1px solid #232733', fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {codes.map((c, i) => (
            <Line key={c} dataKey={c} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={1.5} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
