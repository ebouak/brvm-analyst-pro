'use client';

import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { CoutSGIResult } from '@/lib/sgi-frais/calculateur';

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR') + ' FCFA';
}

/** Dégradé cyan (moins cher) → rouge (plus cher) selon le rang. */
function couleurRang(i: number, n: number): string {
  if (n <= 1) return '#56D7FD';
  const t = i / (n - 1);
  const r = Math.round(86 + t * (255 - 86));
  const g = Math.round(215 - t * (215 - 107));
  const b = Math.round(253 - t * (253 - 107));
  return `rgb(${r},${g},${b})`;
}

/** Graphique en barres horizontal du coût total par SGI, trié croissant. */
export function GraphiqueCoutSGI({
  resultats,
  title = 'Coût total par SGI (FCFA)',
}: {
  resultats: CoutSGIResult[];
  title?: string;
}) {
  const data = [...resultats]
    .sort((a, b) => a.total - b.total)
    .map((r) => ({ nom: r.sgiNom, total: Math.round(r.total) }));

  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="mb-3 text-xs text-muted">{title}</p>
      <div style={{ height: Math.max(160, data.length * 36) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis type="number" tick={{ fill: '#7a9ea8', fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <YAxis type="category" dataKey="nom" width={140} tick={{ fill: '#e5e7eb', fontSize: 11 }} />
            <Tooltip
              formatter={(v: number) => fmt(v)}
              contentStyle={{ background: '#0a1417', border: '1px solid #1a2a30', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            <Bar dataKey="total" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {data.map((_, i) => (
                <Cell key={i} fill={couleurRang(i, data.length)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
