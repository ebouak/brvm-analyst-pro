'use client';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ZAxis,
} from 'recharts';

export interface CurvePoint { emetteur: string; code: string; x: number; y: number }

const COLORS = ['#00c853', '#42a5f5', '#ffb300', '#7e57c2', '#ef5350', '#26c6da', '#ec407a'];

export default function YieldCurveChart({ data }: { data: CurvePoint[] }) {
  const byEmetteur = data.reduce<Record<string, CurvePoint[]>>((acc, p) => {
    (acc[p.emetteur] ??= []).push(p);
    return acc;
  }, {});
  const groups = Object.entries(byEmetteur).map(([em, pts]) => ({
    em,
    pts: [...pts].sort((a, b) => a.x - b.x),
  }));

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-2">Courbe des taux (YTM vs maturité, par émetteur)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 5, right: 16, left: 0, bottom: 10 }}>
          <CartesianGrid stroke="#232733" />
          <XAxis type="number" dataKey="x" name="Maturité (ans)" unit=" a"
            tick={{ fill: '#8b93a7', fontSize: 10 }} domain={['auto', 'auto']} />
          <YAxis type="number" dataKey="y" name="YTM" unit="%"
            tick={{ fill: '#8b93a7', fontSize: 10 }} domain={['auto', 'auto']} width={44} />
          <ZAxis range={[60, 60]} />
          <Tooltip
            contentStyle={{ background: '#161922', border: '1px solid #232733', fontSize: 12 }}
            formatter={(v: number, n: string) => [n === 'y' ? v.toFixed(2) + '%' : v.toFixed(1) + ' a', n === 'y' ? 'YTM' : 'Maturité']}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {groups.map((g, i) => (
            <Scatter key={g.em} name={g.em} data={g.pts} fill={COLORS[i % COLORS.length]} line shape="circle" />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
