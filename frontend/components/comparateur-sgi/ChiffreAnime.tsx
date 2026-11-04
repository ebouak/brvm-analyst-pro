'use client';

import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

/**
 * Nombre qui glisse vers sa nouvelle valeur quand un paramètre change : l'œil
 * suit l'écart au lieu de voir un chiffre sauter. Écrit dans le DOM sans
 * re-rendu React. Mouvement coupé si le système le demande.
 */
export function ChiffreAnime({
  valeur,
  format,
  className,
}: {
  valeur: number;
  /** Doit être stable (défini hors du composant). */
  format: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const affiche = useRef(valeur);
  const reduire = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduire) {
      el.textContent = format(valeur);
      affiche.current = valeur;
      return;
    }
    const controle = animate(affiche.current, valeur, {
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        affiche.current = v;
        el.textContent = format(v);
      },
    });
    return () => controle.stop();
  }, [valeur, format, reduire]);

  return (
    <span ref={ref} className={className}>
      {format(valeur)}
    </span>
  );
}
