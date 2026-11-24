'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, CartesianGrid,
} from 'recharts';
import { chartTheme } from '@/lib/chartTheme';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PriceData {
  nom: string;
  symbole?: string;
  variation_5j_pct?: number;
  variation_mensuelle_pct?: number;
  prix_actuel?: number;
  unite?: string;
}

interface BrvmScore {
  score: number;
  commodites: string[];
  variations: number[];
}

interface CommodityChartsProps {
  yf_prices: Record<string, PriceData>;
  wb_snapshot: Record<string, PriceData>;
  brvm_scores: Record<string, BrvmScore>;
}

function useChartTheme() {
  const [theme, setTheme] = useState(() => chartTheme());
  useEffect(() => {
    const refresh = () => setTheme(chartTheme());
    refresh();
    const obs = new MutationObserver(refresh);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

// ── Tooltip custom ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const v = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-xl border border-border-strong bg-surface/95 px-3.5 py-2 shadow-card backdrop-blur-sm text-xs">
      <p className="mb-0.5 text-muted">{label}</p>
      <p className={`tabular font-semibold ${v >= 0 ? 'text-up' : 'text-down'}`}>
        {v >= 0 ? '+' : ''}{v.toFixed(2)} %
      </p>
    </div>
  );
}

function ScoreTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border-strong bg-surface/95 px-3.5 py-2 shadow-card backdrop-blur-sm text-xs">
      <p className="font-mono font-semibold text-accent-ink">{label}</p>
      <p className="mt-0.5 text-muted">
        Score d&apos;impact : <span className="tabular font-semibold text-ivory">{payload[0]?.value}/100</span>
      </p>
    </div>
  );
}

// ── Graphique 1 : Variations prix semaine ─────────────────────────────────────

export function PriceVariationsChart({ yf_prices }: Pick<CommodityChartsProps, 'yf_prices'>) {
  const theme = useChartTheme();
  const data = Object.values(yf_prices)
    .filter(d => d.variation_5j_pct !== undefined)
    .map(d => ({
      name: d.nom.length > 10 ? d.nom.slice(0, 10) + '…' : d.nom,
      variation: d.variation_5j_pct!,
      prix: d.prix_actuel,
      unite: d.unite,
    }))
    .sort((a, b) => b.variation - a.variation);

  if (!data.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-3">
      <h3 className="font-display text-base font-semibold tracking-tight text-ivory">
        Variations sur 5 jours (futures)
      </h3>
      <div className="rounded-xl border border-border/70 bg-sunken/25 px-2 pt-3 pb-1" style={{ height: 256 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.border} opacity={0.75} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: theme.muted, fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: theme.border }} tickLine={false} />
            <YAxis
              tick={{ fill: theme.muted, fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: theme.border, opacity: 0.2 }} />
            <ReferenceLine y={0} stroke={theme.border} />
            <Bar dataKey="variation" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.variation >= 0 ? theme.up : theme.down} fillOpacity={0.88} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Graphique 2 : Variations World Bank (mensuel) ─────────────────────────────

export function WorldBankChart({ wb_snapshot }: Pick<CommodityChartsProps, 'wb_snapshot'>) {
  const theme = useChartTheme();
  const data = Object.values(wb_snapshot)
    .filter(d => d.variation_mensuelle_pct !== undefined)
    .map(d => ({
      name: d.nom.length > 12 ? d.nom.slice(0, 12) + '…' : d.nom,
      variation: d.variation_mensuelle_pct!,
    }))
    .sort((a, b) => b.variation - a.variation);

  if (!data.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-3">
      <h3 className="font-display text-base font-semibold tracking-tight text-ivory">
        Variation mensuelle – Banque Mondiale
      </h3>
      <div className="rounded-xl border border-border/70 bg-sunken/25 px-2 pt-3 pb-1" style={{ height: 236 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.border} opacity={0.75} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: theme.muted, fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: theme.border }} tickLine={false} />
            <YAxis
              tick={{ fill: theme.muted, fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: theme.border, opacity: 0.2 }} />
            <ReferenceLine y={0} stroke={theme.border} />
            <Bar dataKey="variation" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.variation >= 0 ? theme.accent : theme.down} fillOpacity={0.88} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Graphique 3 : Score exposition BRVM ──────────────────────────────────────

export function BrvmExposureChart({ brvm_scores }: Pick<CommodityChartsProps, 'brvm_scores'>) {
  const theme = useChartTheme();
  const data = Object.entries(brvm_scores)
    .slice(0, 10)
    .map(([ticker, info]) => ({ ticker, score: info.score, comm: info.commodites[0] ?? '' }))
    .sort((a, b) => b.score - a.score);

  if (!data.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-3">
      <div>
        <h3 className="font-display text-base font-semibold tracking-tight text-ivory">
          Exposition BRVM aux matières premières
        </h3>
        <p className="text-xs text-muted">Score 0–100 basé sur l&apos;exposition directe aux matières premières</p>
      </div>
      <div className="rounded-xl border border-border/70 bg-sunken/25 px-2 pt-3 pb-1" style={{ height: 272 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.border} opacity={0.75} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: theme.muted, fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}`} />
            <YAxis type="category" dataKey="ticker" tick={{ fill: theme.accent, fontSize: 12, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={52} />
            <Tooltip content={<ScoreTooltip />} cursor={{ fill: theme.border, opacity: 0.2 }} />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} fill={theme.accent} fillOpacity={0.88} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
