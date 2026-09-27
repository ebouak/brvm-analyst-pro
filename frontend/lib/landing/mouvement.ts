import { useEffect, useRef, type RefObject } from 'react';
import { useAnimationControls, useInView, useReducedMotion, type Variants } from 'framer-motion';

/**
 * Mouvement de la section « La BRVM aujourd'hui ».
 *
 * LE PRINCIPE, qui gouverne tout le reste : ON N'ANIME QUE CE QUE LE VISITEUR
 * N'A PAS ENCORE VU.
 *
 * Le serveur rend l'état FINAL — l'indice à sa vraie valeur, l'aiguille sur le
 * vrai score, la courbe entière. C'est ce que reçoivent les robots
 * d'indexation, les navigateurs sans JavaScript et quiconque arrive
 * directement sur la section : vérifié en production, les chiffres sont dans
 * le HTML servi.
 *
 * Après hydratation seulement, un élément situé SOUS la ligne de flottaison est
 * « armé » : ramené instantanément à son état de départ — hors champ, donc sans
 * que personne le voie — puis joué quand il entre à l'écran. Un élément déjà
 * visible au montage n'est JAMAIS armé : le masquer pour le rejouer ferait
 * clignoter une information que la personne est en train de lire.
 *
 * Deux conséquences voulues :
 * - aucune valeur fausse n'est jamais montrée : l'aiguille ne part pas de zéro
 *   sous les yeux de quelqu'un, un indice ne défile pas depuis 0 ;
 * - l'état de départ ne descend pas à `opacity: 0` : 0,35, pour qu'un incident
 *   d'observateur laisse le contenu lisible — la règle de l'audit de la landing.
 *
 * Ce module ne porte pas `'use client'` : il n'exporte que des hooks et des
 * constantes, consommés par des composants client. Rien ici n'est appelé
 * depuis un composant serveur — voir `lib/landing/formats.ts` pour la raison.
 */

/** Courbe « institutionnelle » : départ franc, arrivée amortie, sans rebond. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Cartes : 20 px de montée, léger zoom, décalage de 0,12 s par rang. */
export const apparitionCarte: Variants = {
  cache: { opacity: 0.35, y: 20, scale: 0.985 },
  visible: (rang: number = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: EASE, delay: rang * 0.12 },
  }),
};

/** En-tête : descend de 12 px, plus court que les cartes. */
export const apparitionEntete: Variants = {
  cache: { opacity: 0.35, y: -12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

interface Options {
  /** Part de l'élément visible pour le déclencher. */
  amount?: number;
  /** Appelé une fois, au moment où l'élément est armé (hors champ). */
  onArme?: () => void;
  /** Appelé une fois, quand un élément armé entre à l'écran. */
  onRevele?: () => void;
}

/**
 * Arme l'élément s'il est hors champ au montage, le joue à son entrée.
 * Renvoie les contrôles à brancher sur `animate` — avec `initial={false}`,
 * pour que le rendu serveur reste l'état final.
 */
export function useRevelation<T extends Element>(ref: RefObject<T>, options: Options = {}) {
  const { amount = 0.2, onArme, onRevele } = options;
  const sobre = useReducedMotion();
  const controls = useAnimationControls();
  const vu = useInView(ref, { once: true, amount });
  const arme = useRef(false);
  const joue = useRef(false);

  // `useEffect` et non `useLayoutEffect` : framer abonne ses contrôles dans
  // l'effet du composant motion, qui s'exécute AVANT celui-ci (effets enfants
  // d'abord). Un `set` en effet de mise en page arriverait avant l'abonnement
  // et serait perdu. Le prix — une image peinte à l'état final avant d'être
  // armée — est invisible : on n'arme que ce qui est hors champ.
  useEffect(() => {
    if (sobre) return;
    const el = ref.current;
    if (!el) return;
    if (el.getBoundingClientRect().top > window.innerHeight) {
      arme.current = true;
      controls.set('cache');
      onArme?.();
    }
    // Armement évalué UNE fois, au montage : c'est tout son sens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!vu || !arme.current || joue.current) return;
    joue.current = true;
    void controls.start('visible');
    onRevele?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vu]);

  return controls;
}
