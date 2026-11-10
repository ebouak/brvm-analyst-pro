'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RUBRIQUES, hrefRubrique, rubriqueDeAncre, type Rubrique } from '@/lib/fiche/rubriques';
import { fmtNumber } from '@/lib/format';

/**
 * Barre collante de la fiche action : une rubrique à la fois (`?rubrique=`).
 * Les six rubriques de la note, puis Mon suivi, séparé (il est personnel).
 * Liens de page (`nav` + `aria-current`) : chaque rubrique a son adresse.
 *
 * Ancres héritées (#dividendes…) : le serveur ne voit pas le fragment, la
 * résolution se fait ici, au montage. Le paramètre `?rubrique=` a toujours
 * priorité ; l'ancre ne sert qu'en son absence.
 */
export function FicheStickyNav({
  code,
  cours,
  variationPct,
  up,
  actif,
  from,
  documents,
}: {
  code: string;
  cours: number | null;
  variationPct: number | null;
  up: boolean;
  actif: Rubrique;
  from: string;
  documents: { href: string; label: string }[];
}) {
  const [compact, setCompact] = useState(false);
  const router = useRouter();
  const premierRendu = useRef(true);

  useEffect(() => {
    const hash = window.location.hash;
    const aParam = new URLSearchParams(window.location.search).has('rubrique');
    const cible = rubriqueDeAncre(hash);
    if (!aParam && cible && cible !== actif) {
      router.replace(hrefRubrique(cible, from, hash.slice(1)), { scroll: false });
      return;
    }
    if (hash && hash !== '#rubrique') document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [actif, from, router]);

  // Onglet actif ramené dans le champ ; au changement de rubrique, focus sur son titre.
  useEffect(() => {
    document.querySelector<HTMLElement>('[data-rubrique][aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    document.getElementById(`${actif}-titre`)?.focus({ preventScroll: true });
  }, [actif]);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 340);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const [docsOuverts, setDocsOuverts] = useState(false);
  const pastille = 'inline-flex items-center max-md:min-h-[44px] whitespace-nowrap rounded-full border border-border px-2.5 py-1 text-muted transition-colors hover:border-accent hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

  const lien = (r: (typeof RUBRIQUES)[number]) => {
    const estActif = r.id === actif;
    return (
      <Link
        key={r.id}
        href={hrefRubrique(r.id, from)}
        data-rubrique={r.id}
        title={r.question}
        aria-current={estActif ? 'page' : undefined}
        className={`flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 transition-[background-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] motion-reduce:active:scale-100 md:min-h-0 md:px-2.5 ${
          estActif ? 'bg-accent/15 font-medium text-accent-ink' : 'text-muted hover:bg-white/[0.04] hover:text-accent-ink'
        }`}
      >
        {r.label}
      </Link>
    );
  };

  // Fond OPAQUE (pas de backdrop-blur) : un backdrop-filter collant par-dessus le
  // canvas du graphique provoque des artefacts de compositing sur Chromium.
  return (
    <nav aria-label="Rubriques de la fiche" className="sticky top-0 z-30 -mx-4 border-b border-border/60 bg-bg px-4 py-2 md:-mx-6 md:px-6">
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
        {/* Défilement horizontal sous 768 px ; le fondu de bord droit signale la suite. */}
        <div className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto text-xs [mask-image:linear-gradient(to_right,black_88%,transparent)] max-md:flex-1 md:[mask-image:none]">
          {RUBRIQUES.filter((r) => r.groupe === 'note').map(lien)}
          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
          {RUBRIQUES.filter((r) => r.groupe === 'perso').map(lien)}
          {documents.length > 0 && (
            <button
              type="button"
              onClick={() => setDocsOuverts((o) => !o)}
              aria-expanded={docsOuverts}
              className="flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 text-muted transition-colors hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
            >
              Documents
            </button>
          )}
        </div>
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
