'use client';

import { useState } from 'react';
import {
  Bar, Cell, ComposedChart, Legend, Line, Pie, PieChart,
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
    frame: 'rounded-xl border border-[#e2d8c4] bg-[#ffffff] p-4',
    caption: 'mb-3 text-xs font-semibold text-[#123a5e]',
    note: 'mt-2 text-[11px] leading-relaxed text-[#6b7b8c]',
  },
} as const;

const nombre = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/**
 * Graphique d'une leçon (illustratif, ou données réelles sourcées si reel=true).
 *
 * Plusieurs séries (2026-11-23) : barres et courbes mêlées, second axe à
 * droite (PER face au cours), et une année sans donnée laissée VIDE — jamais
 * comptée à zéro ni reliée par la courbe. La légende se clique pour masquer
 * ou réafficher une série.
 */
export default function LessonChart({ chart, variant = 'app' }: { chart: Chart; variant?: 'app' | 'slide' }) {
  const t = THEME[variant];
  const [masquees, setMasquees] = useState<Set<string>>(() => new Set());
  const tip = {
    contentStyle: { background: t.tipBg, border: `1px solid ${t.tipBorder}`, borderRadius: 8, fontSize: 12 },
    labelStyle: { color: t.tipLabel },
  };
  const barGold = variant === 'slide' ? '#d4a53c' : t.accent;

  // Une série unique garde l'apparence historique ; plusieurs séries prennent la palette.
  const multi = chart.series.length > 0;
  const series = multi
    ? chart.series
    : [{ nom: chart.titre, valeurs: chart.valeurs, type: undefined, axe: 'gauche' as const }];
  const droite = series.some((s) => s.axe === 'droite');
  const couleur = (k: number) => (multi ? t.pie[k % t.pie.length]! : chart.type === 'bar' ? barGold : t.accent);
  const data = chart.labels.map((label, i) => {
    const ligne: Record<string, string | number | null> = { label };
    series.forEach((s, k) => { ligne[`s${k}`] = s.valeurs[i] ?? null; });
    return ligne;
  });
  const unite = (k: number) => (series[k]?.axe === 'droite' ? chart.unite_droite : chart.unite);
  const basculer = (cle: string) =>
    setMasquees((m) => {
      const n = new Set(m);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });

  return (
    <figure className={t.frame}>
      <figcaption className={t.caption}>{chart.titre}</figcaption>
      <div style={{ height: chart.type === 'pie' ? 280 : multi ? 280 : 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === 'pie' ? (
            <PieChart>
              <Pie
                data={chart.labels.map((label, i) => ({ label, valeur: chart.valeurs[i] ?? 0 }))}
                dataKey="valeur" nameKey="label" innerRadius="45%" outerRadius="80%" paddingAngle={2} isAnimationActive={false}
              >
                {chart.labels.map((_, i) => <Cell key={i} fill={t.pie[i % t.pie.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11, color: t.tipLabel }} />
              <Tooltip {...tip} formatter={(v: number, n: string) => [`${nombre(v)}${chart.unite ? ` ${chart.unite}` : ''}`, n]} />
            </PieChart>
          ) : (
            <ComposedChart data={data} margin={{ left: 4, right: droite ? 4 : 8, top: 8 }}>
              <XAxis dataKey="label" tick={{ fill: t.axis, fontSize: 11 }} />
              <YAxis yAxisId="gauche" tick={{ fill: t.axis, fontSize: 10 }} tickFormatter={(v: number) => nombre(v)} />
              {droite && (
                <YAxis yAxisId="droite" orientation="right" tick={{ fill: t.axis, fontSize: 10 }} tickFormatter={(v: number) => nombre(v)} />
              )}
              <Tooltip
                {...tip}
                formatter={(v, n, item) => {
                  const k = Number(String((item as { dataKey?: unknown } | undefined)?.dataKey ?? 's0').slice(1));
                  const u = unite(k);
                  return [typeof v === 'number' ? `${nombre(v)}${u ? ` ${u}` : ''}` : 'non disponible', multi ? String(n) : ''];
                }}
              />
              {multi && (
                <Legend
                  wrapperStyle={{ fontSize: 11, color: t.tipLabel, cursor: 'pointer' }}
                  onClick={(e: { dataKey?: unknown }) => basculer(String(e.dataKey))}
                  formatter={(valeur: string, e: { dataKey?: unknown }) => (
                    <span style={{ opacity: masquees.has(String(e.dataKey)) ? 0.4 : 1 }}>{valeur}</span>
                  )}
                />
              )}
              {series.map((s, k) => {
                const cle = `s${k}`;
                const type = s.type ?? (chart.type === 'line' ? 'line' : 'bar');
                const axe = s.axe === 'droite' ? 'droite' : 'gauche';
                return type === 'bar' ? (
                  <Bar
                    key={cle} dataKey={cle} name={s.nom} yAxisId={axe} hide={masquees.has(cle)}
                    fill={couleur(k)} fillOpacity={0.9} radius={[3, 3, 0, 0]} isAnimationActive={false}
                  />
                ) : (
                  <Line
                    key={cle} dataKey={cle} name={s.nom} yAxisId={axe} hide={masquees.has(cle)}
                    stroke={couleur(k)} strokeWidth={2.5} dot={{ r: 3, fill: couleur(k) }}
                    connectNulls={false} isAnimationActive={false}
                  />
                );
              })}
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
      {multi && <p className="sr-only">Cliquez sur un élément de la légende pour masquer ou réafficher sa série.</p>}
      <p className={t.note}>
        {chart.note}{' '}
        <span className="italic">
          {chart.reel
            ? '(données réelles à la date de rédaction, sources officielles)'
            : '(valeurs illustratives)'}
        </span>
      </p>
    </figure>
  );
}
