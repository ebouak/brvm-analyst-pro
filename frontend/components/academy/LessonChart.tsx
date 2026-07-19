'use client';

import {
  Bar, BarChart, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Chart } from '@/lib/academy/types';

/** Deux palettes : app (dark cyan) et slide (fidèle au PDF — bleu marine / or / vert). */
const THEME = {
  app: {
    accent: '#56D7FD',
    axis: '#7a9ea8',
    pie: ['#56D7FD', '#ff6b6b', '#3fe18b', '#7a9ea8', '#e8b54d', '#c0504d', '#a1683a', '#8b5cf6'],
    tipBg: '#0a1417',
    tipBorder: '#1a2a30',
    tipLabel: '#e5e7eb',
    frame: 'rounded-xl border border-border bg-surface p-4',
    caption: 'mb-3 text-xs text-muted',
    note: 'mt-2 text-[11px] leading-relaxed text-faint',
  },
  slide: {
    accent: '#123a5e',
    axis: '#6b7b8c',
    pie: ['#123a5e', '#d4a53c', '#2e9e5f', '#c0392b', '#3f6ea5', '#a1683a', '#7a6cae', '#5a8f6b'],
    tipBg: '#ffffff',
    tipBorder: '#d8cfbe',
    tipLabel: '#16324e',
    frame: 'rounded-xl border border-[#e2d8c4] bg-white p-4',
    caption: 'mb-3 text-xs font-semibold text-[#123a5e]',
    note: 'mt-2 text-[11px] leading-relaxed text-[#6b7b8c]',
  },
} as const;

/** Graphique d'une leçon (illustratif, ou données réelles sourcées si reel=true). */
export default function LessonChart({ chart, variant = 'app' }: { chart: Chart; variant?: 'app' | 'slide' }) {
  const t = THEME[variant];
  const data = chart.labels.map((label, i) => ({ label, valeur: chart.valeurs[i] ?? 0 }));
  const tip = {
    contentStyle: { background: t.tipBg, border: `1px solid ${t.tipBorder}`, borderRadius: 8, fontSize: 12 },
    labelStyle: { color: t.tipLabel },
  };
  const barGold = variant === 'slide' ? '#d4a53c' : t.accent;

  return (
    <figure className={t.frame}>
      <figcaption className={t.caption}>{chart.titre}</figcaption>
      <div style={{ height: chart.type === 'pie' ? 280 : 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === 'pie' ? (
            <PieChart>
              <Pie data={data} dataKey="valeur" nameKey="label" innerRadius="45%" outerRadius="80%" paddingAngle={2} isAnimationActive={false}>
                {data.map((_, i) => <Cell key={i} fill={t.pie[i % t.pie.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11, color: t.tipLabel }} />
              <Tooltip {...tip} formatter={(v: number, n: string) => [`${v}${chart.unite ? ` ${chart.unite}` : ''}`, n]} />
            </PieChart>
          ) : chart.type === 'bar' ? (
            <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
              <XAxis dataKey="label" tick={{ fill: t.axis, fontSize: 11 }} />
              <YAxis tick={{ fill: t.axis, fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`${v}${chart.unite ? ` ${chart.unite}` : ''}`, '']} {...tip} />
              <Bar dataKey="valeur" fill={barGold} fillOpacity={0.9} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
              <XAxis dataKey="label" tick={{ fill: t.axis, fontSize: 11 }} />
              <YAxis tick={{ fill: t.axis, fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`${v}${chart.unite ? ` ${chart.unite}` : ''}`, '']} {...tip} />
              <Line dataKey="valeur" stroke={t.accent} strokeWidth={2.5} dot={{ r: 3, fill: t.accent }} isAnimationActive={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <p className={t.note}>
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
