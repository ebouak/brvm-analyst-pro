'use client';

import {
  Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Chart } from '@/lib/academy/types';

const ACCENT = '#56D7FD';
const AXIS = '#7a9ea8';

/** Graphique illustratif d'une leçon (jamais des données de marché réelles). */
export default function LessonChart({ chart }: { chart: Chart }) {
  const data = chart.labels.map((label, i) => ({ label, valeur: chart.valeurs[i] ?? 0 }));

  return (
    <figure className="rounded-xl border border-border bg-surface p-4">
      <figcaption className="mb-3 text-xs text-muted">{chart.titre}</figcaption>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === 'bar' ? (
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
