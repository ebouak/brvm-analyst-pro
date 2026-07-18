'use client';

import {
  Bar, BarChart, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Chart } from '@/lib/academy/types';

const ACCENT = '#56D7FD';
const AXIS = '#7a9ea8';
const PIE_COLORS = ['#56D7FD', '#ff6b6b', '#3fe18b', '#7a9ea8', '#e8b54d', '#c0504d', '#a1683a', '#8b5cf6'];

/** Graphique d'une leçon (illustratif, ou données réelles sourcées si reel=true). */
export default function LessonChart({ chart }: { chart: Chart }) {
  const data = chart.labels.map((label, i) => ({ label, valeur: chart.valeurs[i] ?? 0 }));
  const tip = {
    contentStyle: { background: '#0a1417', border: '1px solid #1a2a30', borderRadius: 8, fontSize: 12 },
    labelStyle: { color: '#e5e7eb' },
  };

  return (
    <figure className="rounded-xl border border-border bg-surface p-4">
      <figcaption className="mb-3 text-xs text-muted">{chart.titre}</figcaption>
      <div style={{ height: chart.type === 'pie' ? 280 : 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === 'pie' ? (
            <PieChart>
              <Pie data={data} dataKey="valeur" nameKey="label" innerRadius="45%" outerRadius="80%" paddingAngle={2} isAnimationActive={false}>
                {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip {...tip} formatter={(v: number, n: string) => [`${v}${chart.unite ? ` ${chart.unite}` : ''}`, n]} />
            </PieChart>
          ) : chart.type === 'bar' ? (
            <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
              <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} />
              <YAxis tick={{ fill: AXIS, fontSize: 10 }} />
              <Tooltip
                formatter={(v: number) => [`${v}${chart.unite ? ` ${chart.unite}` : ''}`, '']}
                contentStyle={{ background: '#0a1417', border: '1px solid #1a2a30', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Bar dataKey="valeur" fill={ACCENT} fillOpacity={0.85} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
              <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} />
              <YAxis tick={{ fill: AXIS, fontSize: 10 }} />
              <Tooltip
                formatter={(v: number) => [`${v}${chart.unite ? ` ${chart.unite}` : ''}`, '']}
                contentStyle={{ background: '#0a1417', border: '1px solid #1a2a30', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Line dataKey="valeur" stroke={ACCENT} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-faint">
        {chart.note}{' '}
        <span className="italic">
          {chart.reel
            ? '(données réelles à la date de rédaction — sources officielles)'
            : '(valeurs illustratives)'}
        </span>
      </p>
    </figure>
  );
}
