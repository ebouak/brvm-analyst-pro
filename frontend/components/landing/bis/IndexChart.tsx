'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { motion, useAnimationControls, type Variants } from 'framer-motion';
import type { Point } from '@/lib/landing/bisData';
import { EASE, useRevelation } from '@/lib/landing/mouvement';

/**
 * Courbe des clôtures du BRVM Composite. Trois fenêtres : 1 mois (≈ 21
 * séances), 3 mois (≈ 63), 1 an (≈ 250). Pas d'onglet « 1 jour » : la BRVM
 * ne publie pas l'indice en intraday et nous n'en avons pas de série — on ne
 * dessine pas ce qu'on n'a pas. Axe Y gradué sur les valeurs réellement
 * atteintes ; texte en jetons du thème.
 *
 * Mouvement (voir lib/landing/mouvement.ts) : le serveur rend la courbe
 * entière. Hors champ, elle est armée puis TRACÉE à chaque entrée à
 * l'écran (et retracée au survol à la souris) — ligne, puis aire, puis SMA, puis le point final. Changer de
 * fenêtre ne rejoue pas le tracé : un bref fondu suffit à signaler que la
 * courbe a changé, sans faire attendre une seconde celui qui compare.
 */

// La SMA est pointillée : animer son pathLength réécrirait son dasharray.
// Elle n'apparaît donc qu'en opacité.
const ligne: Variants = {
  cache: { pathLength: 0 },
  visible: { pathLength: 1, transition: { duration: 1.15, ease: 'easeInOut', delay: 0.2 } },
};
const aire: Variants = {
  cache: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: EASE, delay: 0.7 } },
};
const moyenne: Variants = {
  cache: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, ease: EASE, delay: 1.0 } },
};
const pointFinal: Variants = {
  cache: { opacity: 0, scale: 0 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: EASE, delay: 1.3 } },
};

const FENETRES = [
  { k: '1M', n: 21 },
  { k: '3M', n: 63 },
  { k: '1A', n: 250 },
] as const;

const W = 640, H = 220, PL = 8, PR = 52, PT = 12, PB = 28;

const fmtV = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtD = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}${y ? '' : ''}`; };

export function IndexChart({ serie }: { serie: Point[] }) {
  const [k, setK] = useState<(typeof FENETRES)[number]['k']>('1M');
  const ref = useRef<HTMLDivElement>(null);
  const onglets = useRef<(HTMLButtonElement | null)[]>([]);
  const { controls, rejouer } = useRevelation(ref);
  // Survol à la souris : la courbe se retrace sur place. Pas au toucher —
  // sur mobile, c'est le retour à l'écran qui la rejoue.
  const survol = (e: PointerEvent<HTMLDivElement>) => { if (e.pointerType === 'mouse') rejouer(); };
  const fondu = useAnimationControls();
  const montage = useRef(true);
  useEffect(() => {
    if (montage.current) { montage.current = false; return; }
    void fondu.start({ opacity: [0.3, 1], transition: { duration: 0.25, ease: 'easeOut' } });
  }, [k, fondu]);

  // Onglets ARIA : flèches, Début, Fin ; un seul onglet dans l'ordre de tabulation.
  const surTouche = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = FENETRES.findIndex((f) => f.k === k);
    const cible =
      e.key === 'ArrowRight' ? (i + 1) % FENETRES.length
      : e.key === 'ArrowLeft' ? (i - 1 + FENETRES.length) % FENETRES.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? FENETRES.length - 1
      : null;
    if (cible == null) return;
    e.preventDefault();
    setK(FENETRES[cible].k);
    onglets.current[cible]?.focus();
  };
  const n = FENETRES.find((f) => f.k === k)?.n ?? 21;
  const pts = useMemo(() => serie.slice(-n), [serie, n]);
  // SMA 20 calculée sur la série COMPLÈTE (les 19 séances avant la fenêtre
  // comptent), puis découpée : la moyenne est juste dès le premier point.
  const sma = useMemo(() => {
    const out: (number | null)[] = serie.map((_, i) => i < 19 ? null : serie.slice(i - 19, i + 1).reduce((a, p) => a + p.v, 0) / 20);
    return out.slice(-n);
  }, [serie, n]);

  if (pts.length < 2) return <p className="empty">Pas assez de séances pour tracer la courbe.</p>;

  const smaVals = sma.filter((v): v is number => v != null);
  const vals = [...pts.map((p) => p.v), ...smaVals];
  const min = Math.min(...vals), max = Math.max(...vals);
  const pad = (max - min || 1) * 0.08;
  const lo = min - pad, hi = max + pad;
  const x = (i: number) => PL + (i / (pts.length - 1)) * (W - PL - PR);
  const y = (v: number) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)} ${(H - PB).toFixed(1)} L${PL} ${(H - PB).toFixed(1)} Z`;
  const smaLine = sma.map((v, i) => v == null ? null : `${x(i).toFixed(1)} ${y(v).toFixed(1)}`).filter(Boolean).map((seg, i) => `${i ? 'L' : 'M'}${seg}`).join(' ');
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const xLabels = [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
  const dernier = pts[pts.length - 1];
  const premier = pts[0];
  const varFen = ((dernier.v - premier.v) / premier.v) * 100;

  return (
    <div className="chart" ref={ref} onPointerEnter={survol}>
      <div className="chart-head">
        <div className="tabs" role="tablist" aria-label="Fenêtre" onKeyDown={surTouche}>
          {FENETRES.map((f, i) => (
            <button
              key={f.k}
              ref={(el) => { onglets.current[i] = el; }}
              type="button"
              role="tab"
              aria-selected={f.k === k}
              tabIndex={f.k === k ? 0 : -1}
              onClick={() => setK(f.k)}
              disabled={serie.length < 2}
            >
              {/* La pastille est rendue par le serveur sous l'onglet actif ;
                  framer la fait glisser d'un onglet à l'autre (layoutId). */}
              {f.k === k && <motion.span layoutId="lb-periode-active" className="tab-pill" aria-hidden="true" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
              <span className="tab-lbl">{f.k}</span>
            </button>
          ))}
        </div>
        <span className="legend"><i className="sw sma" aria-hidden="true" />SMA 20</span>
        <span className={`num chart-var ${varFen >= 0 ? 'up' : 'down'}`} aria-label={`Variation sur la fenêtre ${k}`}>
          {varFen >= 0 ? '+' : '−'}{Math.abs(varFen).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} % <small>sur {k === '1M' ? '1 mois' : k === '3M' ? '3 mois' : '1 an'}</small>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`BRVM Composite, ${pts.length} séances, de ${fmtV(premier.v)} à ${fmtV(dernier.v)}`}>
        <defs><linearGradient id="lb-idx" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--color-accent))" stopOpacity=".35" /><stop offset="1" stopColor="rgb(var(--color-accent))" stopOpacity="0" /></linearGradient></defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity=".12" />
            <text x={W - PR + 8} y={y(t) + 4} fontSize="11" fill="currentColor" fillOpacity=".7" className="num">{fmtV(t)}</text>
          </g>
        ))}
        <motion.g initial={false} animate={fondu}>
          <motion.path d={area} fill="url(#lb-idx)" initial={false} animate={controls} variants={aire} />
          <motion.path d={line} fill="none" stroke="rgb(var(--color-accent))" strokeWidth="2" strokeLinejoin="round" initial={false} animate={controls} variants={ligne} />
          {smaLine && <motion.path d={smaLine} fill="none" stroke="rgb(var(--color-sma, var(--color-accent)))" strokeWidth="1.6" strokeDasharray="4 3" strokeLinejoin="round" initial={false} animate={controls} variants={moyenne} />}
          <motion.circle cx={x(pts.length - 1)} cy={y(dernier.v)} r="3.5" fill="rgb(var(--color-accent))" stroke="rgb(var(--color-surface))" strokeWidth="1.5" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} initial={false} animate={controls} variants={pointFinal} />
        </motion.g>
        {xLabels.map((i) => (
          <text key={i} x={x(i)} y={H - 8} fontSize="11" fill="currentColor" fillOpacity=".7" textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}>{fmtD(pts[i].d)}</text>
        ))}
      </svg>
    </div>
  );
}
