'use client';

import { motion } from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import { useArme } from './useArme';

type Props = {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'ul' | 'ol';
};

const conteneur = {
  cache: {},
  visible: { transition: { staggerChildren: 0.02 } },
};

const element = {
  cache: { opacity: 0, scale: 0.3, y: 18, transition: { duration: 0 } },
  visible: {
    opacity: [0, 1, 1],
    scale: [0.3, 1.12, 1],
    y: [18, 0, 0],
    transition: { duration: 0.55, times: [0, 0.6, 1], ease: [0.34, 1.56, 0.64, 1] as const },
  },
};

/**
 * Conteneur dont les `VagueElement` entrent à 20 ms d'écart, une fois à l'écran.
 * Rendu serveur = état final (voir useArme) : la vague ne joue que pour une liste
 * d'abord masquée parce qu'hors écran au chargement, jamais pour celle qu'on voit.
 */
export function Vague({ children, className, as = 'div' }: Props) {
  const ref = useRef<HTMLElement>(null);
  const { arme, vu } = useArme(ref);
  const Tag = as === 'ul' ? motion.ul : as === 'ol' ? motion.ol : motion.div;
  return (
    <Tag ref={ref as never} className={className} variants={conteneur} initial={false} animate={arme ? (vu ? 'visible' : 'cache') : undefined}>
      {children}
    </Tag>
  );
}

export function VagueElement({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li' | 'span';
}) {
  const Tag = as === 'li' ? motion.li : as === 'span' ? motion.span : motion.div;
  return (
    <Tag className={className} variants={element}>
      {children}
    </Tag>
  );
}
