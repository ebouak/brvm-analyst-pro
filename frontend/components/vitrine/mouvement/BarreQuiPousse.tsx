'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties } from 'react';

type Props = {
  axe: 'x' | 'y';
  /** Côté fixe de la barre : 'debut' (gauche / bas) ou 'fin' (droite / haut). */
  origine?: 'debut' | 'fin';
  className?: string;
  style?: CSSProperties;
  delai?: number;
};

/** Barre qui pousse en 1,1 s par `scale` (jamais width/height). Dimensions via className/style. */
export function BarreQuiPousse({ axe, origine = 'debut', className, style, delai = 0 }: Props) {
  const calme = useReducedMotion();
  const cote =
    axe === 'x' ? (origine === 'debut' ? 'left' : 'right') : origine === 'debut' ? 'bottom' : 'top';
  const origineCss = axe === 'x' ? `${cote} center` : `center ${cote}`;
  const depart = axe === 'x' ? { scaleX: 0 } : { scaleY: 0 };
  const arrivee = axe === 'x' ? { scaleX: 1 } : { scaleY: 1 };
  const base: CSSProperties = { ...style, transformOrigin: origineCss };
  if (calme) return <div className={className} style={base} />;
  return (
    <motion.div
      className={className}
      style={base}
      initial={depart}
      whileInView={arrivee}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 1.1, delay: delai, ease: [0.2, 0.7, 0, 1] }}
    />
  );
}
