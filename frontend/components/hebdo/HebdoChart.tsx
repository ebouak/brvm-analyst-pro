'use client';
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

interface Props {
  dates: string[];
  closes: number[];
  rsi: (number | null)[];
  resistance: number | null;
  support: number | null;
}

/** Cours (aire) + RSI(14) en sous-graphe, avec les niveaux réels en repères. */
export default function HebdoChart({ dates, closes, rsi, resistance, support }: Props) {
  const data = dates.map((d, i) => ({ date: d.slice(5), close: closes[i] ?? null, rsi: rsi[i] ?? null }));
  const tip = {
    contentStyle: { background: '#0a1417', border: '1px solid #1a2a30', borderRadius: 8, fontSize: 12 },
    labelStyle: { color: '#e5e7eb' },
  };
  return (
    <div className="space-y-2">
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid stroke="#1a2a30" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#7a9ea8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#7a9ea8', fontSize: 10 }} domain={['auto', 'auto']} />
            <Tooltip {...tip} formatter={(v: number) => [`${v} FCFA`, 'Cours']} />
            {resistance != null && (
              <ReferenceLine y={resistance} stroke="#e8b54d" strokeDasharray="6 4"
                label={{ value: `Résistance ${resistance}`, fill: '#e8b54d', fontSize: 11, position: 'insideTopLeft' }} />
            )}
            {support != null && (
              <ReferenceLine y={support} stroke="#7a9ea8" strokeDasharray="4 4"
                label={{ value: `Support ${support}`, fill: '#7a9ea8', fontSize: 11, position: 'insideBottomLeft' }} />
            )}
            <Area dataKey="close" stroke="#56D7FD" fill="#56D7FD" fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ height: 120 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 4, right: 8, top: 4 }}>
            <CartesianGrid stroke="#1a2a30" vertical={false} />
            <XAxis dataKey="date" hide />
            <YAxis domain={[0, 100]} ticks={[30, 70]} tick={{ fill: '#7a9ea8', fontSize: 10 }} />
            <Tooltip {...tip} formatter={(v: number) => [v?.toFixed?.(1) ?? v, 'RSI']} />
            <ReferenceLine y={70} stroke="#ff6b6b" strokeDasharray="4 4" />
            <ReferenceLine y={30} stroke="#3fe18b" strokeDasharray="4 4" />
            <Line dataKey="rsi" stroke="#3fe18b" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
