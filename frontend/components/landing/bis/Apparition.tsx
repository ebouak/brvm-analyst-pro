'use client';

import { useRef, type ReactNode } from 'react';
import { motion, MotionConfig } from 'framer-motion';
import { apparitionCarte, apparitionEntete, useRevelation } from '@/lib/landing/mouvement';

/**
 * Enveloppe qui fait apparaître une carte — ou l'en-tête — de « La BRVM
 * aujourd'hui » quand elle entre à l'écran.
 *
 * Composant client MINCE : les enfants restent rendus par le serveur. C'est ce
 * qui permet d'animer la section sans transformer `BrvmAujourdhui` en
 * composant client, et donc sans faire passer ses requêtes Supabase côté
 * navigateur.
 *
 * La règle d'armement vit dans `useRevelation` : rien n'est masqué au rendu
 * serveur ; la carte se rejoue à chaque retour à l'écran, réarmée hors champ.
 */

export function Apparition({
  className,
  rang = 0,
  variante = 'carte',
  survol = true,
  children,
}: {
  className?: string;
  /** Position dans l'ordre d'apparition : 0,12 s de décalage par rang. */
  rang?: number;
  variante?: 'carte' | 'entete';
  /** Petite montée au survol, sur pointeur uniquement (framer ignore le tactile). */
  survol?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { controls } = useRevelation(ref);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={controls}
      custom={rang}
      variants={variante === 'entete' ? apparitionEntete : apparitionCarte}
      // Seulement `y` : l'ombre et la bordure passent par le CSS (`:hover`),
      // qui les anime sans toucher à la mise en page. Framer posant `transform`
      // en style en ligne, une montée au survol écrite en CSS serait écrasée.
      whileHover={survol ? { y: -3, transition: { duration: 0.2, ease: 'easeOut' } } : undefined}
    >
      {children}
    </motion.div>
  );
}

/**
 * `reducedMotion="user"` : sous « réduire les animations » du système, framer
 * coupe les transformations. `useRevelation` va plus loin et n'arme rien du
 * tout — la section s'affiche directement, dans son état final.
 */
export function MouvementSobre({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
