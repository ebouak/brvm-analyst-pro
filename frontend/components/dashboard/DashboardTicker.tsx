'use client';

import Link from 'next/link';

export interface TickerLine {
  code: string;
  value: string;
  variation: number | null;
  kind: 'action' | 'obligation';
}

/** Bandeau de cours en défilement permanent (actions + obligations). */
export default function DashboardTicker({ items }: { items: TickerLine[] }) {
  if (items.length === 0) return null;
  const loop = [...items, ...items];

  return (
    <div className="relative overflow-hidden rounded-full border border-border bg-surface/70 py-2.5 shadow-card">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-bg to-transparent" />
      <div className="flex w-max animate-ticker gap-7 px-6 font-mono">
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
