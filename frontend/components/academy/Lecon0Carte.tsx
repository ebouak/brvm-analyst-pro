import Link from 'next/link';
import { LECON0 } from '@/lib/academy/lecon0';

/**
 * Carte « Leçon 0 · gratuite » du hub Academy et de /formations. Affichée à
 * TOUS, y compris au-dessus du bloc d'accès premium : la leçon 0 est la porte
 * d'entrée gratuite de la formation (décision du 2026-09-29).
 *
 * Seule image réelle de ces pages : c'est elle qui porte la couleur, le reste
 * reste neutre autour.
 */
export function Lecon0Carte({ className = '' }: { className?: string }) {
  return (
    <Link
      href={LECON0.chemin}
      className={`group flex items-center gap-4 rounded-xl border border-border bg-surface p-3 transition-colors hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LECON0.vignette}
        alt=""
        width={96}
        height={104}
        loading="lazy"
        className="h-[104px] w-24 flex-none rounded-lg object-cover"
      />
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
