'use client';

import { motion } from 'framer-motion';
import { useRef } from 'react';
import { useArme } from './mouvement/useArme';

/** Lettres de passage (décoratives) avant la note réelle, qui arrive en dernier. */
const PASSAGE = ['F', 'D', 'C', 'E'];

/**
 * Lettre qui roule jusqu'à la meilleure note du jour. HTML serveur et premier
 * rendu = la note finale (règle `useArme`) ; le roulement ne joue que si la
 * carte entre plus tard à l'écran. Les lettres de passage sont masquées aux
 * lecteurs d'écran : seule la note réelle est lue.
 */
export function RoueNote({ lettre }: { lettre: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const { masque } = useArme(ref);
  const lettres = [...PASSAGE.filter((l) => l !== lettre), lettre];
  const fin = `${(-(lettres.length - 1) / lettres.length) * 100}%`;
  return (
    <span ref={ref} className="v-roue">
      <span className="sr-only">Note {lettre}</span>
      <motion.span
        aria-hidden="true"
        className="v-roue-rail"
        initial={false}
        animate={{ y: masque ? '0%' : fin }}
        transition={masque ? { duration: 0 } : { duration: 1.8, delay: 0.25, ease: [0.12, 0.85, 0.15, 1] }}
      >
        {lettres.map((l, i) => <span key={`${l}-${i}`}>{l}</span>)}
      </motion.span>
    </span>
  );
}
