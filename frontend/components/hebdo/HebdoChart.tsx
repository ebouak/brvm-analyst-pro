'use client';

import { useEffect, useId, useState } from 'react';
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { chartTheme } from '@/lib/chartTheme';

interface Props {
  dates: string[];
  closes: number[];
  rsi: (number | null)[];
  resistance: number | null;
  support: number | null;
}

const nf = new Intl.NumberFormat('fr-FR');

/** Cours (aire) + RSI(14) en sous-graphe, avec les niveaux réels en repères. */
export default function HebdoChart({ dates, closes, rsi, resistance, support }: Props) {
  const uid = useId().replace(/:/g, '');
  const [theme, setTheme] = useState(() => chartTheme());

  useEffect(() => {
    const refresh = () => setTheme(chartTheme());
    refresh();
    const obs = new MutationObserver(refresh);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => obs.disconnect();
  }, []);

  const data = dates.map((d, i) => ({ date: d.slice(5), close: closes[i] ?? null, rsi: rsi[i] ?? null }));
  const tip = {
    contentStyle: {
      background: theme.surface,
      border: `1px solid ${theme.border}`,
      borderRadius: 12,
      fontSize: 12,
      color: theme.ivory,
    },
    labelStyle: { color: theme.muted, fontFamily: 'var(--font-mono)', fontSize: 11 },
  };
  const axisTick = { fill: theme.muted, fontSize: 11, fontFamily: 'var(--font-mono)' };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/70 bg-sunken/25 px-2 pt-3 pb-1" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
            <defs>
              <linearGradient id={`hc-area-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.accent} stopOpacity={0.22} />
                <stop offset="100%" stopColor={theme.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.border} opacity={0.75} vertical={false} />
            <XAxis dataKey="date" tick={axisTick} axisLine={{ stroke: theme.border }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} domain={['auto', 'auto']} tickFormatter={(v) => nf.format(Math.round(v))} width={54} />
            <Tooltip {...tip} formatter={(v: number) => [`${nf.format(Math.round(v))} FCFA`, 'Cours']} />
            {resistance != null && (
              <ReferenceLine y={resistance} stroke={theme.warn} strokeDasharray="6 4"
                label={{ value: `Résistance ${nf.format(resistance)}`, fill: theme.warn, fontSize: 11, position: 'insideTopLeft' }} />
            )}
            {support != null && (
              <ReferenceLine y={support} stroke={theme.muted} strokeDasharray="4 4"
                label={{ value: `Support ${nf.format(support)}`, fill: theme.muted, fontSize: 11, position: 'insideBottomLeft' }} />
            )}
            <Area type="monotone" dataKey="close" stroke={theme.accent} fill={`url(#hc-area-${uid})`} strokeWidth={2.25} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-xl border border-border/70 bg-sunken/25 px-2 pt-2 pb-1" style={{ height: 124 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 4, right: 8, top: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.border} opacity={0.75} vertical={false} />
            <XAxis dataKey="date" hide />
            <YAxis domain={[0, 100]} ticks={[30, 70]} tick={axisTick} axisLine={false} tickLine={false} width={32} />
            <Tooltip {...tip} formatter={(v: number) => [v?.toFixed?.(1) ?? v, 'RSI']} />
            <ReferenceLine y={70} stroke={theme.down} strokeDasharray="4 4" />
            <ReferenceLine y={30} stroke={theme.up} strokeDasharray="4 4" />
            <Line type="monotone" dataKey="rsi" stroke={theme.up} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
