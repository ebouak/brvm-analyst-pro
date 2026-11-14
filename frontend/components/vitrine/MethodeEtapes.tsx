'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { etatMethode } from '@/lib/vitrine/outilsPur';

export interface EtapeMethode {
  titre: string;
  description: string;
  /** Fait réel de la séance (déjà formaté côté serveur), ou null. */
  fait: { libelle: string; valeur: string } | null;
}

const PAS_MS = 1000;

/**
 * Sept étapes : un trait lumineux parcourt la ligne et chaque étape s'allume à
 * son tour, DEUX tours puis arrêt (charte §10), et arrêt définitif au premier
 * survol. HTML serveur = état final : toutes les étapes allumées, trait absent.
 * Sous mouvement réduit, rien ne bouge. Seuls transform et opacity sont animés
 * pour le trait ; les étapes changent de couleur, sans décaler la mise en page.
 */
export function MethodeEtapes({ etapes }: { etapes: EtapeMethode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const calme = useReducedMotion();
  const vu = useInView(ref, { once: true, amount: 0.3 });
  const [t, setT] = useState<number | null>(null);
  const [stop, setStop] = useState(false);

  useEffect(() => {
    if (!vu || calme || stop) return;
    let raf = 0;
    const debut = performance.now();
    const pas = (now: number) => {
      const e = now - debut;
      setT(e);
      if (!etatMethode(e, etapes.length, PAS_MS).fini) raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [vu, calme, stop, etapes.length]);

  const etat = t == null || stop ? null : etatMethode(t, etapes.length, PAS_MS);
  const joue = etat != null && !etat.fini;

  return (
    <div ref={ref} className={`v-methode${joue ? ' v-methode--joue' : ''}`} onPointerEnter={() => setStop(true)} onFocusCapture={() => setStop(true)}>
      <div className="v-methode-fil" aria-hidden="true">
        {joue && <span className="v-methode-trait" style={{ transform: `translateX(${etat.trait * 733}%)` }} />}
      </div>
      <ol className="v-etapes">
        {etapes.map((e, i) => (
          <li key={e.titre} className={`v-etape${joue && etat.active === i ? ' v-etape--on' : ''}`}>
            <span className="v-etape-num" aria-hidden="true">{i + 1}</span>
            <b>{e.titre}</b>
            <span className="v-etape-desc">{e.description}</span>
            {e.fait && (
              <span className="v-etape-fait">
                {e.fait.libelle}
                <strong>{e.fait.valeur}</strong>
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
