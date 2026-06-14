import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Bouton de navigation avec un « faisceau » cyan qui trace le contour en
 * rotation (adaptation compacte de l'effet pulse-beams, dimensionnée pour une
 * barre de nav — l'effet hero 858×434 ne tient pas ici). Server-component,
 * pure CSS (keyframe `spin` par défaut de Tailwind). Respecte reduced-motion.
 */
export function BeamButton({
  href,
  children,
  className = '',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative inline-flex overflow-hidden rounded-full p-[1.5px] ${className}`}
    >
      {/* Faisceau cyan en rotation autour du bord */}
      <span
        aria-hidden
        className="absolute inset-[-150%] motion-safe:animate-[spin_3.5s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_295deg,#22d3ee_338deg,#7dd3fc_352deg,transparent_360deg)]"
      />
      {/* Cœur du bouton (recouvre le centre → seul le contour montre le faisceau) */}
      <span className="relative inline-flex min-h-[40px] items-center rounded-full bg-[#0e1014] px-4 text-sm font-medium text-muted transition-colors group-hover:text-ivory">
        {children}
      </span>
    </Link>
  );
}
