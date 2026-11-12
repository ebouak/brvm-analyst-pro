'use client';

import { motion } from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import { useArme } from './useArme';

type Props = {
  children: ReactNode;
  /** Délai avant l'entrée, en secondes. */
  delai?: number;
  as?: 'div' | 'section' | 'li';
  className?: string;
};

const composants = { div: motion.div, section: motion.section, li: motion.li } as const;

/**
 * Entrée d'un bloc au défilement : montée de 26 px + fondu, une seule fois.
 * Rendu serveur = état final (voir useArme) : rien n'est masqué sans JavaScript.
 */
export function Apparition({ children, delai = 0, as = 'div', className }: Props) {
  const ref = useRef<HTMLElement>(null);
  const { masque } = useArme(ref);
  const Tag = composants[as];
  return (
    <Tag
      ref={ref as never}
      className={className}
      initial={false}
      animate={masque ? { opacity: 0, y: 26 } : { opacity: 1, y: 0 }}
      transition={masque ? { duration: 0 } : { duration: 0.9, delay: delai, ease: [0.2, 0.7, 0, 1] }}
    >
      {children}
    </Tag>
  );
}
