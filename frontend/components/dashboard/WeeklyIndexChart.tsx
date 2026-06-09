'use client';

import { useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Line, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

export interface Candle {
  label: string;       // Lun, Mar, ...
  date: string;        // ISO
  open: number;        // = clôture veille
  close: number;       // = valeur du jour
  body: [number, number]; // [min(open,close), max(open,close)]
  up: boolean;
}

interface Props {
  title: string;
  code: string;
  candles: Candle[];   // ordre chronologique (ancien -> récent)
  rsi: number | null;
  macd: number | null;
  lastValue: string;
  lastVar: number | null;
}

const UP = '#3fe18b';
const DOWN = '#ff6b6b';
const CYAN = '#56d7fd';

export default function WeeklyIndexChart({ title, code, candles, rsi, macd, lastValue, lastVar }: Props) {
  const [weeks, setWeeks] = useState<1 | 3>(1);

  const data = useMemo(() => {
    const span = weeks === 1 ? 5 : 15;
    return candles.slice(-span);
  }, [candles, weeks]);

  const lastIdx = data.length - 1;
  const domain = useMemo(() => {
    const vals = data.flatMap((d) => [d.open, d.close]);
    if (vals.length === 0) return [0, 1] as [number, number];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min || max * 0.002) * 0.4 + max * 0.0005;
    return [min - pad, max + pad] as [number, number];
  }, [data]);

  const up = (lastVar ?? 0) >= 0;

  return (
    <section
      className="overflow-hidden rounded-panel border border-border bg-surface shadow-card"
      aria-label={`${title} — évolution hebdomadaire en bougies`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h3 className="font-display text-base text-ivory">{title}</h3>
          <span className="overline text-faint">{code}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="tabular text-lg font-semibold text-ivory">{lastValue}</span>
            {lastVar != null && (
              <span className={`tabular ml-2 text-xs font-medium ${up ? 'text-up' : 'text-down'}`}>
                {up ? '▲' : '▼'} {Math.abs(lastVar).toFixed(2)}%
              </span>
            )}
          </div>
          <div className="flex rounded-full border border-border-strong p-0.5">
            {([1, 3] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeeks(w)}
                aria-pressed={weeks === w}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  weeks === w ? 'bg-cyan text-[#03222b]' : 'text-muted hover:text-ivory'
                }`}
              >
                {w}W
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="px-2 pt-4">
        {data.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted">Historique de l’indice indisponible.</div>
        ) : (
          <ResponsiveContainer width="100%" height={236}>
            <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <defs>
                <linearGradient id={`trend-${code}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CYAN} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fill: '#b5b5b5', fontSize: 11 }}
                axisLine={{ stroke: '#1b2a30' }}
                tickLine={false}
              />
              <YAxis
                domain={domain}
                tick={{ fill: '#5c6b70', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v: number) => v.toFixed(0)}
              />
              <Tooltip
                cursor={{ fill: 'rgba(86,215,253,0.06)' }}
                contentStyle={{ background: '#0a1417', border: '1px solid #1b2a30', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#fcfcfc' }}
                formatter={(_v, _n, p) => {
                  const c = p?.payload as Candle | undefined;
                  if (!c) return ['', ''];
                  return [`O ${c.open.toFixed(2)} · C ${c.close.toFixed(2)}`, c.up ? 'Hausse' : 'Baisse'];
                }}
              />
              {/* Corps des bougies (open->close), barre flottante */}
              <Bar dataKey="body" barSize={18} radius={[2, 2, 2, 2]} isAnimationActive={false}>
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={i === lastIdx ? CYAN : d.up ? UP : DOWN}
                    fillOpacity={i === lastIdx ? 1 : 0.55}
                    stroke={i === lastIdx ? CYAN : 'none'}
                    strokeWidth={i === lastIdx ? 1 : 0}
                  />
                ))}
              </Bar>
              {/* Ligne de tendance cyan (clôtures) */}
              <Line
                type="monotone"
                dataKey="close"
                stroke={CYAN}
                strokeWidth={2}
                dot={{ r: 2.5, fill: CYAN, strokeWidth: 0 }}
                activeDot={{ r: 4, fill: CYAN }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Indicateurs techniques + repère jour courant */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-faint">
          <span className="inline-block h-2 w-2 rounded-full bg-cyan shadow-[0_0_8px_#56d7fd]" />
          Jour courant ({data[lastIdx]?.label ?? '—'}) mis en évidence
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="rounded-full border border-border bg-elevated px-2 py-0.5 text-muted">
            RSI <span className={rsi == null ? 'text-faint' : 'text-ivory'}>{rsi != null ? rsi.toFixed(0) : '—'}</span>
          </span>
          <span className="rounded-full border border-border bg-elevated px-2 py-0.5 text-muted">
            MACD <span className={macd == null ? 'text-faint' : 'text-ivory'}>{macd != null ? macd.toFixed(2) : '—'}</span>
          </span>
        </div>
      </div>
    </section>
  );
}
