'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartTheme } from '@/lib/chartTheme';

/** Personnes distinctes par semaine et par continent. L'Afrique (première série) garde la couleur d'accent. */
export default function TendanceContinents({ donnees, continents }: { donnees: Record<string, string | number>[]; continents: string[] }) {
  const [theme, setTheme] = useState(() => chartTheme());
  useEffect(() => {
    const refresh = () => setTheme(chartTheme());
    refresh();
    const obs = new MutationObserver(refresh);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => obs.disconnect();
  }, []);

  const couleurs = [theme.accent, theme.up, theme.warn, theme.down, '#8b6fc2', theme.muted, '#d97706'];
  const axisTick = { fill: theme.muted, fontSize: 11, fontFamily: 'var(--font-mono)' };

  return (
    <div className="h-72 w-full" role="img" aria-label="Évolution hebdomadaire des personnes mesurées par continent">
      <ResponsiveContainer>
        <LineChart data={donnees} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={theme.border} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="semaine" tick={axisTick} axisLine={{ stroke: theme.border }} tickLine={false} tickFormatter={(s: string) => s.slice(5)} />
          <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 12, color: theme.ivory }}
            labelFormatter={(s) => `Semaine du ${String(s)}`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          {continents.map((c, i) => (
            <Line key={c} type="monotone" dataKey={c} stroke={couleurs[i % couleurs.length]} strokeWidth={c === 'Afrique' ? 3 : 1.5} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
