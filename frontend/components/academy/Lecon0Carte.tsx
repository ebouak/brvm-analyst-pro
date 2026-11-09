'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { LECON0 } from '@/lib/academy/lecon0';

/**
 * Carte « Leçon 0 · gratuite » du hub Academy et de /formations. Affichée à
 * TOUS, y compris au-dessus du bloc d'accès premium : la leçon 0 est la porte
 * d'entrée gratuite de la formation (décision du 2026-09-29).
 *
 * Seule image réelle de ces pages : c'est elle qui porte la couleur, le reste
 * reste neutre autour. Si l'image manque (bucket absent, fichier retiré), une
 * vignette neutre prend sa place : jamais d'icône d'image brisée.
 */
export function Lecon0Carte({ className = '' }: { className?: string }) {
  const [imageKo, setImageKo] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  // L'image peut avoir échoué avant l'hydratation : onError ne se déclenche alors jamais.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setImageKo(true);
  }, []);
  return (
    <Link
      href={LECON0.chemin}
      className={`group flex items-center gap-4 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${className}`}
    >
      {imageKo ? (
        <div
          aria-hidden
          className="flex h-[104px] w-24 flex-none items-center justify-center rounded-lg border border-border bg-elevated text-faint"
        >
          <GraduationCap size={28} strokeWidth={1.5} />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={LECON0.vignette}
          alt=""
          width={96}
          height={104}
          loading="lazy"
          onError={() => setImageKo(true)}
          className="h-[104px] w-24 flex-none rounded-lg object-cover"
        />
      )}
      <div className="min-w-0">
        <p className="font-display text-base text-ivory transition-colors group-hover:text-accent-ink">
          {LECON0.titre}
        </p>
        <p className="mt-1 text-xs text-accent-ink">
          Leçon 0 · gratuite · vidéo <span className="tabular">{LECON0.duree}</span>
        </p>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{LECON0.resume}</p>
      </div>
    </Link>
  );
}
