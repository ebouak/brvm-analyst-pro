'use client';

import Link from 'next/link';

export interface TickerLine {
  code: string;
  value: string;
  variation: number | null;
  kind: 'action' | 'obligation';
  spark?: number[]; // mini sparkline 5-10 séances
}

/** Mini sparkline SVG pour le ticker (rendu client). */
function TickerSpark({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return null;
  const w = 36, h = 14;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const stroke = up ? '#3fe18b' : '#ff6b6b';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0 opacity-70">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Bandeau de cours en défilement permanent (actions + obligations). */
export default function DashboardTicker({ items }: { items: TickerLine[] }) {
  if (items.length === 0) return null;
  const loop = [...items, ...items];

  return (
    <div
      className="group relative overflow-hidden rounded-full border border-border bg-surface/70 py-2 shadow-card"
      role="marquee"
      aria-label="Cours des actions et obligations en défilement"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-bg to-transparent" />
      <div className="flex w-max animate-ticker items-center gap-6 px-6 font-mono group-hover:[animation-play-state:paused]">
        {loop.map((it, i) => {
          const up = (it.variation ?? 0) >= 0;
          return (
            <Link
              key={`${it.code}-${i}`}
              href={it.kind === 'action' ? `/actions/${it.code}` : '/obligations'}
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold transition-opacity hover:opacity-100"
            >
              {it.kind === 'obligation' && <span className="text-[9px] text-faint">◆</span>}
              <span className="text-muted">{it.code}</span>
              {it.kind === 'action' && it.spark && <TickerSpark data={it.spark} up={up} />}
              <span className="text-ivory">{it.value}</span>
              {it.variation != null && (
                <span className={up ? 'text-up' : 'text-down'}>
                  {up ? '+' : ''}{it.variation.toFixed(2)}%
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
