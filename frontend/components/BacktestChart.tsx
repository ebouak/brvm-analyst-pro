'use client';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceArea,
} from 'recharts';

interface Props {
  equityCurve: { date_index: number; date?: string; value: number }[];
  closes: number[];
  dates?: string[];
  drawdownPeriods?: { start: number; end: number }[];
}

function formatDate(iso: string): string {
  // Format ISO date as dd/MM/yy
  const parts = iso.slice(0, 10).split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]!.slice(2)}`;
}

export default function BacktestChart({ equityCurve, closes, dates, drawdownPeriods }: Props) {
  if (equityCurve.length === 0 || closes.length === 0) {
    return <div className="text-muted text-sm p-4">Aucune donnée à afficher.</div>;
  }

  const base = closes[0] ?? 1;

  const data = equityCurve.map((pt) => {
    const rawDate = pt.date ?? dates?.[pt.date_index];
    return {
      date_index: pt.date_index,
      label: rawDate ? formatDate(rawDate) : String(pt.date_index),
      rawDate,
      strategie: Math.round(pt.value * 100) / 100,
      buyhold: Math.round(100 * ((closes[pt.date_index] ?? base) / base) * 100) / 100,
    };
  });

  const hasDate = data.some((d) => d.rawDate !== undefined);

  return (
    <div className="bg-surface border border-border rounded-xl p-4 min-h-[400px]">
      <h3 className="text-sm font-semibold mb-2">📈 Courbe d&apos;équité</h3>
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#232733" vertical={false} />
          <XAxis
            dataKey={hasDate ? 'label' : 'date_index'}
            tick={{ fill: '#8b93a7', fontSize: 10 }}
            minTickGap={60}
          />
          <YAxis tick={{ fill: '#8b93a7', fontSize: 10 }} domain={['auto', 'auto']} width={56} />
          <Tooltip
            contentStyle={{ background: '#161922', border: '1px solid #232733', fontSize: 12 }}
            labelStyle={{ color: '#e6e9f0' }}
            labelFormatter={(label) => (hasDate ? `Date : ${label}` : `Jour ${label}`)}
            formatter={(v: number, name: string) => [`${v.toFixed(2)}`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {(drawdownPeriods ?? []).map((d, i) => (
            <ReferenceArea
              key={i}
              x1={hasDate ? data[d.start]?.label : d.start}
              x2={hasDate ? data[d.end]?.label : d.end}
              fill="#f4433620"
              fillOpacity={1}
              stroke="none"
            />
          ))}
          <Line dataKey="strategie" name="Stratégie" stroke="#00c853" dot={false} strokeWidth={1.5} />
          <Line dataKey="buyhold" name="Buy & Hold" stroke="#8b93a7" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
