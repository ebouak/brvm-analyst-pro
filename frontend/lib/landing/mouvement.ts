import { useEffect, useRef, type RefObject } from 'react';
import { useAnimationControls, useInView, useReducedMotion, type Variants } from 'framer-motion';

/**
 * Mouvement de la section « La BRVM aujourd'hui ».
 *
 * LE PRINCIPE, qui gouverne tout le reste : ON NE REMET À L'ÉTAT DE DÉPART
 * QUE CE QUE LE VISITEUR NE VOIT PAS. L'animation revient à chaque retour à
 * l'écran (réarmée hors champ) et, pour la courbe et la jauge, au survol.
 *
 * Le serveur rend l'état FINAL — l'indice à sa vraie valeur, l'aiguille sur le
 * vrai score, la courbe entière. C'est ce que reçoivent les robots
 * d'indexation, les navigateurs sans JavaScript et quiconque arrive
 * directement sur la section : vérifié en production, les chiffres sont dans
 * le HTML servi.
 *
 * Après hydratation seulement, un élément situé SOUS la ligne de flottaison est
 * « armé » : ramené instantanément à son état de départ — hors champ, donc sans
 * que personne le voie — puis joué quand il entre à l'écran, et de nouveau à
 * chaque retour après en être entièrement sorti. Un élément déjà
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
  /** Appelé chaque fois que l'élément est armé (toujours hors champ). */
  onArme?: () => void;
  /** Appelé chaque fois qu'un élément armé entre à l'écran. */
  onRevele?: () => void;
}

/**
 * Joue l'élément CHAQUE FOIS qu'il entre à l'écran (demande explicite :
 * l'animation doit revenir quand l'écran repasse à son niveau).
 *
 * - Au montage, un élément déjà visible n'est pas armé : on ne masque pas ce
 *   que la personne lit au chargement.
 * - Il est (ré)armé dès qu'il est ENTIÈREMENT sorti de l'écran — test à
 *   `amount: 0`, donc plus un seul pixel visible : le retour à l'état de
 *   départ se fait toujours hors champ, jamais sous les yeux.
 * - Il est joué quand il revient (seuil `amount`, 20 % par défaut).
 *
 * Renvoie les contrôles à brancher sur `animate` (avec `initial={false}`,
 * pour que le rendu serveur reste l'état final) et `rejouer`, pour relancer
 * l'animation à la demande — au survol, par exemple.
 */
export function useRevelation<T extends Element>(ref: RefObject<T>, options: Options = {}) {
  const { amount = 0.2, onArme, onRevele } = options;
  const sobre = useReducedMotion();
  const controls = useAnimationControls();
  const vu = useInView(ref, { amount });
  const present = useInView(ref, { amount: 0 });
  const arme = useRef(false);
  const enCours = useRef(false);

  const armer = () => {
    arme.current = true;
    controls.set('cache');
    onArme?.();
  };

  const jouer = () => {
    arme.current = false;
    enCours.current = true;
    void controls.start('visible').then(() => { enCours.current = false; });
    onRevele?.();
  };

  // `useEffect` et non `useLayoutEffect` : framer abonne ses contrôles dans
  // l'effet du composant motion, qui s'exécute AVANT celui-ci (effets enfants
  // d'abord). Un `set` en effet de mise en page arriverait avant l'abonnement
  // et serait perdu.
  useEffect(() => {
    if (sobre) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top > window.innerHeight || r.bottom < 0) armer();
    // Évalué une fois, au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sorti entièrement : on réarme, hors champ.
  useEffect(() => {
    if (sobre || present || arme.current) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top > window.innerHeight || r.bottom < 0) armer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present]);

  // Revenu à l'écran : on joue.
  useEffect(() => {
    if (!vu || !arme.current) return;
    jouer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vu]);

  /** Relance l'animation sur place (survol, focus). Ignorée pendant une
   *  lecture en cours, et sous « réduire les animations ». */
  const rejouer = () => {
    if (sobre || enCours.current) return;
    controls.set('cache');
    enCours.current = true;
    void controls.start('visible').then(() => { enCours.current = false; });
  };

  return { controls, rejouer };
}
