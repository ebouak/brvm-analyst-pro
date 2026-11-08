'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
  documents,
}: {
  code: string;
  cours: number | null;
  variationPct: number | null;
  up: boolean;
  sections: { id: string; label: string }[];
  documents: { href: string; label: string }[];
}) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 340);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const [docsOuverts, setDocsOuverts] = useState(false);
  const pastille = 'inline-flex items-center max-md:min-h-[44px] whitespace-nowrap rounded-full border border-border px-2.5 py-1 text-muted transition-colors hover:border-accent hover:text-accent-ink';

  // Fond OPAQUE (pas de backdrop-blur) : un backdrop-filter collant par-dessus le
  // canvas du graphique provoque des artefacts de compositing (zones noires au
  // scroll) sur Chromium. Le fond plein évite ce bug.
  return (
    <nav aria-label="Chapitres de la fiche" className="sticky top-0 z-30 -mx-4 border-b border-border/60 bg-bg px-4 py-2 md:-mx-6 md:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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
        {/* Chapitres : onglets défilants sous 768 px, cibles de 44 px */}
        <div className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto text-xs max-md:flex-1">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex min-h-[44px] items-center whitespace-nowrap rounded-full px-3 py-1 text-muted transition-colors hover:bg-white/[0.04] hover:text-accent-ink md:min-h-0 md:px-2.5"
            >
              {s.label}
            </a>
          ))}
          {documents.length > 0 && (
            <button
              type="button"
              onClick={() => setDocsOuverts((o) => !o)}
              aria-expanded={docsOuverts}
              className="flex min-h-[44px] items-center whitespace-nowrap rounded-full px-3 py-1 text-muted transition-colors hover:text-accent-ink md:hidden"
            >
              Documents
            </button>
          )}
        </div>
        {/* Documents : pastilles à droite, à la ligne sous 900 px ; derrière « Documents » sous 768 px */}
        {documents.length > 0 && (
          <div className={`${docsOuverts ? 'flex' : 'hidden'} w-full flex-wrap gap-2 text-xs md:ml-auto md:flex md:w-auto`}>
            {documents.map((d) => (
              <Link key={d.href} href={d.href} className={pastille}>
                {d.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
