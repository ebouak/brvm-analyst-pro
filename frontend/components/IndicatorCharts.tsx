'use client';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell,
} from 'recharts';

export interface IndicatorPoint {
  date: string;
  rsi: number | null;
  macd: number | null;
  signal: number | null;
  hist: number | null;
}

export default function IndicatorCharts({ data }: { data: IndicatorPoint[] }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-2">RSI (14)</h3>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#232733" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#8b93a7', fontSize: 10 }} minTickGap={40} />
            <YAxis domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} tick={{ fill: '#8b93a7', fontSize: 10 }} width={28} />
            <Tooltip contentStyle={{ background: '#161922', border: '1px solid #232733', fontSize: 12 }} />
            <ReferenceLine y={70} stroke="#f44336" strokeDasharray="3 3" />
            <ReferenceLine y={30} stroke="#00c853" strokeDasharray="3 3" />
            <Line dataKey="rsi" stroke="#42a5f5" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-2">MACD (12, 26, 9)</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#232733" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#8b93a7', fontSize: 10 }} minTickGap={40} />
            <YAxis tick={{ fill: '#8b93a7', fontSize: 10 }} width={36} />
            <Tooltip contentStyle={{ background: '#161922', border: '1px solid #232733', fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#8b93a7" />
            <Bar dataKey="hist" name="Histogramme">
              {data.map((d, i) => (
                <Cell key={i} fill={(d.hist ?? 0) >= 0 ? '#00c853' : '#f44336'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
