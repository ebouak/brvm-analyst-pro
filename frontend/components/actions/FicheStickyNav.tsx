'use client';

import { useEffect, useState } from 'react';
import { fmtNumber } from '@/lib/format';

/**
 * Navigation d'ancres collante de la fiche action. Au scroll au-delà du hero,
 * affiche un mini-header compact (code + cours + variation) à gauche des ancres.
 */
export function FicheStickyNav({
  code,
  cours,
  variationPct,
  up,
  sections,
}: {
  code: string;
  cours: number | null;
  variationPct: number | null;
  up: boolean;
  sections: { id: string; label: string }[];
}) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 340);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className="sticky top-0 z-30 -mx-4 flex items-center gap-3 overflow-x-auto border-b border-border/60 bg-bg/80 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
      {compact && cours != null && (
        <span className="mr-1 flex shrink-0 items-center gap-2 border-r border-border/60 pr-3">
          <span className="text-sm font-semibold text-ivory">{code}</span>
          <span className="tabular text-sm text-ivory">{fmtNumber(cours)}</span>
          <span className={`tabular text-xs font-semibold ${up ? 'text-up' : 'text-down'}`}>
            {up ? '+' : ''}
            {(variationPct ?? 0).toFixed(2)}%
          </span>
        </span>
      )}
      <div className="flex items-center gap-1 text-xs">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="whitespace-nowrap rounded-full px-2.5 py-1 text-muted transition-colors hover:bg-white/[0.04] hover:text-gold"
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
