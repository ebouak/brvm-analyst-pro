'use client';
import { useEffect, useState } from 'react';
import type { Slide } from '@/lib/landing/slides';

/**
 * Bandeau pleine largeur — UNE création par chargement de page.
 *
 * Pourquoi pas une n-ième diapositive du carrousel : au-delà de quelques vues,
 * une diapositive n'est vue par presque personne (NN/g ; Runyon : 84 % des
 * clics sur la première). Ici, chaque création active a la MÊME chance d'être
 * affichée, indépendamment de son rang.
 *
 * Pourquoi le tirage est fait au client, après montage :
 *  · la landing est servie en cache (ISR, 300 s) — un tirage au rendu serveur
 *    resterait figé pendant toute la durée du cache, donc toujours la même
 *    création ;
 *  · tirer pendant le rendu provoquerait une divergence d'hydratation.
 * L'emplacement garde une hauteur fixe : rien ne saute quand la création
 * apparaît (CLS), et s'il n'y a aucune création active, RIEN n'est rendu —
 * pas de cadre vide (équivalent de `collapseEmptyDivs` côté régie).
 */

export function Billboard({ creations, slot }: { creations: Slide[]; slot: string }) {
  const [i, setI] = useState<number | null>(null);
  useEffect(() => {
    if (creations.length > 0) setI(Math.floor(Math.random() * creations.length));
  }, [creations.length]);

  if (creations.length === 0) return null;
  const s = i == null ? null : creations[i];

  return (
    <aside className="bb" aria-label={slot}>
      <div className="bb-in">
        {s && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s.imageUrl && <img src={s.imageUrl} alt="" width={1600} height={300} loading="lazy" />}
            <span className="bb-tag">{s.kind === 'ad' ? `Publicité · ${s.sponsorName}` : 'WESTBOURSE'}</span>
            <div className="bb-copy">
              <b>{s.title}</b>
              {s.subtitle && <span>{s.subtitle}</span>}
            </div>
            {s.linkUrl && (
              <a
                href={s.linkUrl}
                className="btn btn-gold btn-sm"
                rel={s.kind === 'ad' ? 'sponsored noopener' : undefined}
                target={s.kind === 'ad' ? '_blank' : undefined}
              >
                {s.ctaLabel ?? 'En savoir plus'}
              </a>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
