'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { FlashDirection } from '@/lib/realtime/mergeActions';

/**
 * Flash « fort » des pages de l'application : fond, couleur et léger
 * agrandissement pendant 650 ms quand un cours change (direct ou rejeu).
 * La landing garde `FlashValue`, plus discret : ce composant ne la touche pas.
 *
 * Le flash repart à chaque nouvelle valeur, même si le sens est le même que
 * la fois précédente (deux hausses de suite pendant un rejeu). Une valeur qui
 * change SANS sens fourni (tri, filtre) ne flashe pas : ce n'est pas un cours.
 * Coupé sous prefers-reduced-motion (globals.css).
 */
export function FlashFort({
  children,
  direction = 'none',
  className = '',
}: {
  children: ReactNode;
  direction?: FlashDirection;
  className?: string;
}) {
  const [actif, setActif] = useState<FlashDirection>('none');
  const [tour, setTour] = useState(0);
  const contenu = useRef(String(children));
  const dernierSens = useRef<FlashDirection>('none');
  // Minuterie hors du cycle des effets : l'effacement du sens par le parent
  // (direction → 'none') ne doit pas l'annuler.
  const minuteur = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(minuteur.current), []);

  useEffect(() => {
    const k = String(children);
    const change = k !== contenu.current;
    contenu.current = k;
    if (direction === 'none') return;
    if (!change && dernierSens.current === direction) return;
    dernierSens.current = direction;
    setActif(direction);
    setTour((n) => n + 1);
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => {
      setActif('none');
      dernierSens.current = 'none';
    }, 650);
  }, [children, direction]);

  // L'animation repart en alternant deux noms d'animation identiques (classe
  // `alt`) : SURTOUT pas en recréant le nœud (clé), ce qui réinitialiserait
  // l'enfant — un ChiffreRoulant perdrait son roulement au moment même où la
  // valeur change.
  const cls = actif === 'up' ? 'f-up' : actif === 'down' ? 'f-down' : '';
  return (
    <span className={`flash-fort ${cls} ${tour % 2 ? 'alt' : ''} ${className}`}>
      {children}
    </span>
  );
}
