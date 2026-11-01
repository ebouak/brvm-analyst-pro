'use client';

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const COULEURS = ['#56D7FD', '#3fe18b', '#f5c451', '#ff6b6b', '#a78bfa', '#94a3b8', '#fb923c'];

/** Personnes distinctes par semaine et par continent. L'Afrique (première série) garde la couleur d'accent. */
export default function TendanceContinents({ donnees, continents }: { donnees: Record<string, string | number>[]; continents: string[] }) {
  return (
    <div className="h-72 w-full" role="img" aria-label="Évolution hebdomadaire des personnes mesurées par continent">
      <ResponsiveContainer>
        <LineChart data={donnees} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#1b2a30" strokeDasharray="3 3" />
          <XAxis dataKey="semaine" tick={{ fill: '#8b949e', fontSize: 11 }} tickFormatter={(s: string) => s.slice(5)} />
          <YAxis allowDecimals={false} tick={{ fill: '#8b949e', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#0a1417', border: '1px solid #1b2a30', borderRadius: 8, fontSize: 12 }} labelFormatter={(s) => `Semaine du ${String(s)}`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {continents.map((c, i) => (
            <Line key={c} type="monotone" dataKey={c} stroke={COULEURS[i % COULEURS.length]} strokeWidth={c === 'Afrique' ? 3 : 1.5} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
