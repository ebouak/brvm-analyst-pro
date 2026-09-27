'use client';

import { useEffect, useMemo, useRef } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';

/**
 * Un nombre qui glisse vers sa nouvelle valeur quand elle change.
 *
 * ⚠️ IL NE PART JAMAIS DE ZÉRO. Le premier rendu affiche la valeur réelle,
 * celle que le serveur a calculée. Faire défiler « 0 → 540,78 » afficherait
 * pendant une seconde un indice BRVM qui n'a jamais existé — sur un produit
 * dont la règle est de ne montrer aucun chiffre inventé. L'animation ne joue
 * donc qu'entre deux vraies valeurs : quand le temps réel en apporte une
 * nouvelle.
 *
 * ⚠️ LECTEURS D'ÉCRAN. Le texte qui défile est `aria-hidden` ; seule la valeur
 * finale est exposée, dans un `sr-only`. Sans cela, un conteneur `aria-live`
 * annoncerait chaque étape intermédiaire — une trentaine de nombres faux par
 * seconde.
 */

export interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  locale?: string;
  /** Durée du glissement, en secondes. */
  duration?: number;
  /** Formatage libre, prioritaire sur decimals/prefix/suffix (ex. « 4,31 Md FCFA »). */
  format?: (v: number) => string;
}

export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  locale = 'fr-FR',
  duration = 0.9,
  format,
}: AnimatedNumberProps) {
  const sobre = useReducedMotion();
  const formater = useMemo(() => {
    if (format) return format;
    const nf = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return (v: number) => `${prefix}${nf.format(v)}${suffix}`;
  }, [format, locale, decimals, prefix, suffix]);

  const mv = useMotionValue(value);
  const texte = useTransform(mv, formater);
  const precedente = useRef(value);

  useEffect(() => {
    if (precedente.current === value) return;
    precedente.current = value;
    if (sobre) {
      mv.set(value);
      return;
    }
    const lecture = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => lecture.stop();
  }, [value, sobre, duration, mv]);

  return (
    <>
      <motion.span aria-hidden="true">{texte}</motion.span>
      <span className="sr-only">{formater(value)}</span>
    </>
  );
}
