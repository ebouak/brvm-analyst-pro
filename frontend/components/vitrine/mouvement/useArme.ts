'use client';

import { useEffect, useState, type RefObject } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

/**
 * Règle commune des entrées au défilement : le HTML serveur et le premier rendu
 * montrent TOUJOURS l'état final (lisible sans JavaScript, sans animation, et
 * indexable). Une entrée n'est « armée » qu'après le montage, et seulement si
 * son bloc est alors sous la ligne de flottaison : ce qui est déjà à l'écran ne
 * disparaît jamais pour réapparaître.
 *
 * Renvoie `masque` (le bloc attend son entrée) et `vu` (il est entré, une fois).
 */
export function useArme(ref: RefObject<Element | null>, amount = 0.15): { masque: boolean; vu: boolean; arme: boolean } {
  const calme = useReducedMotion();
  const vu = useInView(ref, { once: true, amount });
  const [arme, setArme] = useState(false);
  useEffect(() => {
    if (calme || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.9) setArme(true);
  }, [calme, ref]);
  return { masque: arme && !vu, vu, arme };
}
