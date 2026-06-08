'use client';

export interface TickerItem {
  code: string;
  cours: number | null;
  variation: number | null;
}

/** Bandeau défilant des cours — boucle continue (duplication pour seamless loop). */
export default function LandingTicker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null;
  const loop = [...items, ...items];

  return (
    <div className="relative overflow-hidden border-y border-border/70 bg-onyx/60 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-bg to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-bg to-transparent z-10" />
      <div className="flex w-max animate-ticker gap-8 py-3">
        {loop.map((it, i) => {
          const up = (it.variation ?? 0) >= 0;
          return (
            <div key={`${it.code}-${i}`} className="flex items-center gap-2.5 whitespace-nowrap">
              <span className="text-xs font-semibold tracking-wide text-ivory/90">{it.code}</span>
              <span className="tabular text-xs text-muted">
                {it.cours != null ? it.cours.toLocaleString('fr-FR') : '—'}
              </span>
              <span className={`tabular text-xs font-medium ${up ? 'text-up' : 'text-down'}`}>
                {it.variation != null ? `${up ? '+' : ''}${it.variation.toFixed(2)}%` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
