'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { debutScene, dureeTotale, sceneA } from '@/lib/vitrine/mouvement';
import './mouvement.css';

type Scene = { duree: number };

export type EtatSequence = {
  index: number;
  /** Avancement dans la scène courante, 0..1. */
  progression: number;
  progressionTotale: number;
  enPause: boolean;
  basculer: () => void;
  /** Saute à une scène (navigation manuelle). */
  aller: (index: number) => void;
};

type Options = {
  /** Faux : l'horloge s'arrête (cadre hors écran). */
  actif?: boolean;
  /** Numéro (1-based) de la scène montrée sous mouvement réduit. */
  sceneCalme?: number;
};

/** Horloge d'une séquence de scènes minutées, avec bouclage et pause. */
export function useSequence(scenes: Scene[], { actif = true, sceneCalme = 1 }: Options = {}): EtatSequence {
  const calme = useReducedMotion();
  const [enPause, setEnPause] = useState(false);
  const [t, setT] = useState(0);
  const tRef = useRef(0);
  const [manuel, setManuel] = useState<number | null>(null);
  const total = dureeTotale(scenes);
  const calmeIndex = Math.min(Math.max(sceneCalme, 1), Math.max(scenes.length, 1)) - 1;

  const tourne = actif && !enPause && !calme && total > 0;
  useEffect(() => {
    if (!tourne) return;
    let raf = 0;
    let dernier = performance.now();
    const pas = (now: number) => {
      tRef.current = (tRef.current + (now - dernier) / 1000) % total;
      dernier = now;
      setT(tRef.current);
      raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [tourne, total]);

  const aller = useCallback(
    (i: number) => {
      const n = scenes.length;
      if (n === 0) return;
      const idx = ((i % n) + n) % n;
      tRef.current = debutScene(scenes, idx);
      setT(tRef.current);
      setManuel(idx);
    },
    [scenes],
  );

  const basculer = useCallback(() => setEnPause((p) => !p), []);

  if (calme) {
    const index = manuel ?? calmeIndex;
    return { index, progression: 1, progressionTotale: 1, enPause: true, basculer, aller };
  }
  return { ...sceneA(scenes, t), enPause, basculer, aller };
}

type Props = {
  scenes: Scene[];
  /** Une entrée par scène ; une seule est montée à la fois. */
  children: ReactNode[];
  /** Numéro (1-based) de la scène la plus informative, montrée sous mouvement réduit. */
  sceneCalme?: number;
  className?: string;
  /** Libellé accessible du film. */
  label?: string;
};

/** Enchaînement de scènes en coupes franches, lu seulement quand le cadre est visible. */
export function Sequence({ scenes, children, sceneCalme = 1, className, label = 'Film de séance' }: Props) {
  const calme = useReducedMotion();
  const cadre = useRef<HTMLDivElement>(null);
  const [vu, setVu] = useState(false);

  useEffect(() => {
    const el = cadre.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([e]) => setVu(e.isIntersecting), { threshold: 0.25 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { index, progressionTotale, enPause, basculer, aller } = useSequence(scenes, {
    actif: vu,
    sceneCalme,
  });

  return (
    <div ref={cadre} className={className} role="group" aria-roledescription="film" aria-label={label}>
      <div>{children[index]}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {calme ? (
          <>
            <button type="button" className="vm-seq__bouton" onClick={() => aller(index - 1)} aria-label="Scène précédente">
              {'‹'}
            </button>
            <button type="button" className="vm-seq__bouton" onClick={() => aller(index + 1)} aria-label="Scène suivante">
              {'›'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="vm-seq__bouton"
              onClick={basculer}
              aria-label={enPause ? 'Reprendre la lecture' : 'Mettre en pause'}
              aria-pressed={enPause}
            >
              {enPause ? '▶' : '❚❚'}
            </button>
            <div style={{ flex: 1, overflow: 'hidden' }} aria-hidden="true">
              <motion.div className="vm-seq__barre" style={{ scaleX: progressionTotale }} />
            </div>
          </>
        )}
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {index + 1} / {scenes.length}
        </span>
      </div>
    </div>
  );
}
