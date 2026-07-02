'use client';

import { useEffect, useRef, useState } from 'react';
import type { FlashDirection } from '@/lib/realtime/mergeActions';

/**
 * Affiche une valeur et joue un flash de fond vert/rouge quand elle change en
 * temps réel. Respecte `prefers-reduced-motion` (pas d'animation, juste la
 * valeur mise à jour). Le flash est déclenché soit par la prop `direction`
 * (pilotée par le hook Realtime), soit par une variation détectée de `children`.
 */
export function FlashValue({
  children,
  direction = 'none',
  className = '',
}: {
  children: React.ReactNode;
  direction?: FlashDirection;
  className?: string;
}) {
  const [active, setActive] = useState<FlashDirection>('none');
  const prevKey = useRef<string>(String(children));

  useEffect(() => {
    // Flash si le hook signale une direction, ou si le contenu a changé.
    const key = String(children);
    const contentChanged = key !== prevKey.current;
    prevKey.current = key;
    const dir = direction !== 'none' ? direction : contentChanged ? 'up' : 'none';
    if (dir === 'none') return;
    setActive(dir);
    const t = setTimeout(() => setActive('none'), 600);
    return () => clearTimeout(t);
  }, [children, direction]);

  const flashClass =
    active === 'up'
      ? 'flash-up'
      : active === 'down'
        ? 'flash-down'
        : '';

  return <span className={`flash-value ${flashClass} ${className}`}>{children}</span>;
}
