'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useJetons } from '@/lib/theme/jetons';
import { fmtFcfa, fmtDateFR } from '@/lib/format';
import type { EquityPoint } from '@/lib/portfolio/derive';

const JETONS = ['accent', 'muted', 'border', 'surface', 'ivory'] as const;

/** Valeur du portefeuille et capital investi. Pas d'indice superposé (spec §4.5). */
export default function CourbeValeur({ points }: { points: EquityPoint[] }) {
  const c = useJetons(JETONS);
  if (points.length < 2) {
    return <p className="py-8 text-center text-sm text-muted">Historique insuffisant pour tracer la courbe (positions trop récentes).</p>;
  }
  const premier = points[0];
  const dernier = points[points.length - 1];
  const resume = `Valeur du portefeuille : ${fmtFcfa(premier.value)} FCFA au ${fmtDateFR(premier.date)}, ${fmtFcfa(dernier.value)} FCFA au ${fmtDateFR(dernier.date)} ; capital investi : ${fmtFcfa(dernier.invested)} FCFA.`;
  return (
    <div className="h-56 w-full" role="img" aria-label={resume}>
      <p className="sr-only">{resume}</p>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 6, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => fmtDateFR(d).slice(0, 5)} stroke={c.muted} style={{ fontSize: 11 }} minTickGap={28} />
          <YAxis tickFormatter={(v: number) => fmtFcfa(v)} stroke={c.muted} style={{ fontSize: 11 }} width={72} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 8, color: c.ivory }}
            labelFormatter={(d) => fmtDateFR(String(d))}
            formatter={(v, nom) => [`${fmtFcfa(Number(v))} FCFA`, nom]}
          />
          <Line type="monotone" dataKey="invested" name="Capital investi" stroke={c.muted} strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="value" name="Valeur" stroke={c.accent} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
