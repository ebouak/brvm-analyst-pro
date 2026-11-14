'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { SVGProps } from 'react';

type Props = {
  d: string;
  className?: string;
  strokeWidth?: number;
  stroke?: string;
  /** Délai avant le tracé, en secondes. */
  delai?: number;
  /** Durée du tracé, en secondes (2 à 3 s). */
  duree?: number;
} & Pick<SVGProps<SVGPathElement>, 'strokeLinecap' | 'strokeLinejoin' | 'fill' | 'vectorEffect'>;

/** Courbe SVG qui se trace via pathLength. À placer dans un `<svg>`. */
export function TraceCourbe({
  d,
  className,
  strokeWidth = 2,
  stroke = 'currentColor',
  delai = 0,
  duree = 2.6,
  fill = 'none',
  strokeLinecap = 'round',
  strokeLinejoin = 'round',
  vectorEffect,
}: Props) {
  const calme = useReducedMotion();
  const commun = { d, className, strokeWidth, stroke, fill, strokeLinecap, strokeLinejoin, vectorEffect };
  if (calme) return <path {...commun} />;
  return (
    <motion.path
      {...commun}
      initial={{ pathLength: 0 }}
      whileInView={{ pathLength: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: duree, delay: delai, ease: [0.45, 0, 0.2, 1] }}
    />
  );
}
