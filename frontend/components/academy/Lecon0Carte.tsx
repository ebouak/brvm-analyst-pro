import Link from 'next/link';
import { LECON0 } from '@/lib/academy/lecon0';

/**
 * Carte « Leçon 0 · gratuite » du hub Academy et de /formations. Affichée à
 * TOUS, y compris au-dessus du bloc d'accès premium : la leçon 0 est la porte
 * d'entrée gratuite de la formation (décision du 2026-09-29).
 */
export function Lecon0Carte({ className = '' }: { className?: string }) {
  return (
    <Link
      href={LECON0.chemin}
      className={`group flex items-center gap-4 overflow-hidden rounded-xl border border-accent/30 bg-surface p-3 transition hover:border-accent/60 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LECON0.vignette} alt="" width={96} height={104} loading="lazy" className="h-[104px] w-24 flex-none rounded-lg object-cover" />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-widest text-accent">Leçon 0 · gratuite · vidéo {LECON0.duree}</p>
        <p className="mt-1 font-display text-base text-white transition group-hover:text-accent">{LECON0.titre}</p>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{LECON0.resume}</p>
      </div>
    </Link>
  );
}
