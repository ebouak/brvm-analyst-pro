'use client';

import { useEffect, useState } from 'react';
import type { Slide } from '@/lib/landing/slides';

/**
 * Encart publicitaire unique (charte §6) : UNE campagne par chargement, tirée
 * au client après montage (sous ISR, un tirage serveur resterait figé 5 min et
 * provoquerait une divergence d'hydratation). Ni carrousel, ni animation. La
 * réserve a la hauteur de l'encart : rien ne saute quand il apparaît.
 * L'étiquette « PUBLICITÉ » est HORS de l'encart.
 */
export function EncartPublicite({ campagnes }: { campagnes: Slide[] }) {
  const [i, setI] = useState<number | null>(null);
  useEffect(() => {
    if (campagnes.length > 0) setI(Math.floor(Math.random() * campagnes.length));
  }, [campagnes.length]);
  if (campagnes.length === 0) return null;
  const c = i == null ? null : campagnes[i];

  return (
    <div className="v-pub">
      <p className="v-pub-etiquette">PUBLICITÉ</p>
      {!c ? (
        <div className="v-pub-reserve bande-claire" aria-hidden="true" />
      ) : (
        <Corps c={c} />
      )}
    </div>
  );
}

function Corps({ c }: { c: Slide }) {
  const contenu = (
    <>
      <span className="v-pub-texte">
        {c.sponsorName && <span className="v-pub-annonceur">{c.sponsorName}</span>}
        <span className="v-pub-titre">{c.title}</span>
        {c.subtitle && <span className="v-pub-ligne">{c.subtitle}</span>}
        {c.linkUrl && <span className="v-pub-action">{c.ctaLabel ?? 'En savoir plus'} ›</span>}
      </span>
      <span className="v-pub-visuel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {c.imageUrl && <img src={c.imageUrl} alt="" loading="lazy" style={{ objectFit: c.imageFit ?? 'cover' }} />}
      </span>
    </>
  );
  return c.linkUrl ? (
    <a className="v-pub-carte bande-claire" href={c.linkUrl} target="_blank" rel="sponsored noopener">{contenu}</a>
  ) : (
    <div className="v-pub-carte bande-claire">{contenu}</div>
  );
}
