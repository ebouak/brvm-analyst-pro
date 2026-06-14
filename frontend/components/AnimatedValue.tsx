'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimateNumber } from '@/components/animated-blur-number';

/**
 * Valeur numérique animée par COMPTAGE progressif (tween 0 → valeur), de sorte
 * que tous les chiffres roulent visiblement avec le flou d'AnimateNumber — à
 * l'apparition comme à chaque changement de valeur (rafraîchissement live).
 *
 * Démarre à 0 (SSR + client) → aucune dérive d'hydratation. Respecte
 * prefers-reduced-motion (affiche directement la valeur finale).
 */
export function AnimatedValue({
  value,
  format,
  locale = 'fr-FR',
  suffix,
  signed = false,
  rampMs = 750,
  blur = 14,
  className,
}: {
  value: number;
  format?: Intl.NumberFormatOptions;
  locale?: string;
  suffix?: string;
  signed?: boolean;
  rampMs?: number;
  blur?: number;
  className?: string;
}) {
  const [v, setV] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || value === fromRef.current) { setV(value); fromRef.current = value; return; }

    const from = fromRef.current;
    const to = value;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / rampMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setV(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else { setV(to); fromRef.current = to; }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, rampMs]);

  const prefix = signed && value > 0 ? '+' : undefined;

  return (
    <AnimateNumber
      value={v}
      format={format}
      locale={locale}
      prefix={prefix}
      suffix={suffix}
      duration={160}
      blur={blur}
      className={className}
    />
  );
}
