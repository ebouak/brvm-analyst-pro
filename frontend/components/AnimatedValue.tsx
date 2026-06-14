'use client';

import { useEffect, useState } from 'react';
import { AnimateNumber } from '@/components/animated-blur-number';

/**
 * Valeur numérique animée (comptage flou chiffre par chiffre) :
 *  - effet d'apparition depuis 0 au montage ;
 *  - ré-animation à chaque changement de valeur (rafraîchissement live).
 *
 * Démarre à 0 côté SSR ET client → aucune dérive d'hydratation.
 */
export function AnimatedValue({
  value,
  format,
  locale = 'fr-FR',
  suffix,
  signed = false,
  duration = 700,
  blur = 14,
  className,
}: {
  value: number;
  format?: Intl.NumberFormatOptions;
  locale?: string;
  suffix?: string;
  signed?: boolean;
  duration?: number;
  blur?: number;
  className?: string;
}) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(value));
    return () => cancelAnimationFrame(id);
  }, [value]);

  const prefix = signed && value > 0 ? '+' : undefined;

  return (
    <AnimateNumber
      value={v}
      format={format}
      locale={locale}
      prefix={prefix}
      suffix={suffix}
      duration={duration}
      blur={blur}
      className={className}
    />
  );
}
