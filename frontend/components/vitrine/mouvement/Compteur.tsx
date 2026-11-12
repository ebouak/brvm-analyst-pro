'use client';

import { useEffect, useRef } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { fmtNumber } from '@/lib/format';
import { valeurCompteur } from '@/lib/vitrine/mouvement';

type Props = {
  valeur: number;
  decimales: number;
  prefixe?: string;
  suffixe?: string;
  className?: string;
};

const DUREE_MS = 1500;

/**
 * Chiffre qui défile jusqu'à sa valeur. Le premier rendu (serveur compris)
 * porte déjà la valeur finale : SEO et CLS intacts. L'animation part à
 * l'entrée dans l'écran, une seule fois, en écrivant directement dans le nœud.
 */
export function Compteur({ valeur, decimales, prefixe = '', suffixe = '', className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const calme = useReducedMotion();
  const visible = useInView(ref, { once: true, amount: 0.15 });
  const final = `${prefixe}${fmtNumber(valeur, decimales)}${suffixe}`;

  useEffect(() => {
    const el = ref.current;
    if (!visible || calme || !el) return;
    const texte = (v: number) => `${prefixe}${fmtNumber(v, decimales)}${suffixe}`;
    let raf = 0;
    const debut = performance.now();
    const pas = (now: number) => {
      const t = (now - debut) / DUREE_MS;
      el.textContent = texte(valeurCompteur(0, valeur, t));
      if (t < 1) raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => {
      cancelAnimationFrame(raf);
      el.textContent = texte(valeur);
    };
  }, [visible, calme, valeur, decimales, prefixe, suffixe]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {final}
    </span>
  );
}
