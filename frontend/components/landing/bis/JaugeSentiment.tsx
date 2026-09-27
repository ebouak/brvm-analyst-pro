'use client';

import { useRef } from 'react';
import { animate, motion, useMotionValue, useTransform, type Variants } from 'framer-motion';
import { EASE, useRevelation } from '@/lib/landing/mouvement';

/**
 * Jauge du sentiment de séance : arc rouge → ambre → vert, aiguille sur le score.
 *
 * Rendu serveur = aiguille sur le VRAI score (initial={false}). Seule une jauge
 * hors champ au montage est armée : l'aiguille est posée au centre (50, neutre)
 * et les arcs effacés, puis, à l'entrée à l'écran, les arcs se tracent et
 * l'aiguille rejoint le score par un ressort amorti. Elle ne part jamais de 0 :
 * « 0/100 » serait une lecture fausse, même une demi-seconde.
 */

const cx = 100, cy = 96, r = 78;

const point = (a: number, rayon: number) => [
  cx + rayon * Math.cos(Math.PI * (1 - a)),
  cy - rayon * Math.sin(Math.PI * (1 - a)),
] as const;

const arc = (a0: number, a1: number) => {
  const [x0, y0] = point(a0, r), [x1, y1] = point(a1, r);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};

const trace: Variants = {
  cache: { pathLength: 0 },
  visible: (rang: number = 0) => ({ pathLength: 1, transition: { duration: 0.45, ease: EASE, delay: 0.15 + rang * 0.12 } }),
};

const libelleVariants: Variants = {
  cache: { opacity: 0.35, y: 4 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE, delay: 1.05 } },
};

export function JaugeSentiment({ score }: { score: number }) {
  const s = Math.max(0, Math.min(100, score));
  const ref = useRef<HTMLDivElement>(null);
  const mv = useMotionValue(s);
  const x2 = useTransform(mv, (v) => point(v / 100, r - 14)[0]);
  const y2 = useTransform(mv, (v) => point(v / 100, r - 14)[1]);

  const controls = useRevelation(ref, {
    onArme: () => mv.set(50),
    onRevele: () => {
      void animate(mv, s, { type: 'spring', stiffness: 70, damping: 14, mass: 0.8, delay: 0.55 });
    },
  });

  const libelle = s >= 60 ? 'Positif' : s <= 40 ? 'Négatif' : 'Neutre';

  return (
    <div ref={ref}>
      <svg viewBox="0 0 200 104" className="gauge-svg" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s)} aria-label="Sentiment de séance">
        <motion.path d={arc(0, 0.4)} fill="none" stroke="rgb(var(--color-down))" strokeWidth="14" initial={false} animate={controls} variants={trace} custom={0} />
        <motion.path d={arc(0.4, 0.6)} fill="none" stroke="rgb(var(--color-warn))" strokeWidth="14" initial={false} animate={controls} variants={trace} custom={1} />
        <motion.path d={arc(0.6, 1)} fill="none" stroke="rgb(var(--color-up))" strokeWidth="14" initial={false} animate={controls} variants={trace} custom={2} />
        {/* x2/y2 sont des MotionValue initialisées sur le score : le HTML servi
            porte déjà l'aiguille à sa vraie place. */}
        <motion.line x1={cx} y1={cy} x2={x2} y2={y2} stroke="rgb(var(--color-ivory))" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="6" fill="rgb(var(--color-ivory))" />
      </svg>
      <motion.p className={`word ${s >= 60 ? 'up' : s <= 40 ? 'down' : ''}`} initial={false} animate={controls} variants={libelleVariants}>
        {libelle} <span className="num">({Math.round(s)}/100)</span>
      </motion.p>
    </div>
  );
}
