'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { useReducedMotion } from 'framer-motion';
import { fmtNumber, fmtDateFR } from '@/lib/format';
import { pctTexte, type SceneIndice as Donnees } from '@/lib/vitrine/seance';

const L = 560, H = 184, M = 8;

/**
 * Scène de l'indice (spec §3.3). À l'ouverture, la courbe se rejoue en 2,8 s et le
 * chiffre suit les valeurs RÉELLES ; au survol ou au doigt, on remonte séance par
 * séance avec la vraie date. Un tableau des valeurs est lu par les lecteurs d'écran.
 */
export function SceneIndice({ d, releve }: { d: Donnees; releve: string | null }) {
  const n = d.serie.length;
  const calme = useReducedMotion();
  const [pos, setPos] = useState(n - 1); // position fractionnaire 0..n-1
  const [survol, setSurvol] = useState<number | null>(null);
  const raf = useRef<number | null>(null);
  const zone = useRef<HTMLDivElement>(null);
  const joue = useRef(false);

  const rejouer = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    let t0: number | null = null;
    const D = 2800;
    const pas = (t: number) => {
      if (t0 === null) t0 = t;
      const k = Math.min(1, (t - t0) / D);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      setPos(e * (n - 1));
      raf.current = k < 1 ? requestAnimationFrame(pas) : null;
    };
    setSurvol(null);
    raf.current = requestAnimationFrame(pas);
  }, [n]);

  // Rejoue une seule fois, quand la scène entre à l'écran (jamais hors écran).
  useEffect(() => {
    if (calme || !zone.current) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting && !joue.current) { joue.current = true; rejouer(); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(zone.current);
    return () => { io.disconnect(); if (raf.current) cancelAnimationFrame(raf.current); };
  }, [calme, rejouer]);

  const parcourir = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    if (raf.current) { cancelAnimationFrame(raf.current); raf.current = null; }
    setSurvol(Math.round(t * (n - 1)));
  };

  // Une seule échelle pour la courbe complète et la partie déjà tracée.
  const ecart = d.haut - d.bas || 1;
  const xy = d.serie.map((s, k) => [(k * L) / (n - 1), M + ((d.haut - s.valeur) / ecart) * (H - 2 * M)] as const);
  const chemin = (pts: readonly (readonly [number, number])[]) => pts.map(([px, py], k) => `${k ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');

  const p = survol ?? pos;
  const i0 = Math.floor(p), f = p - i0;
  const a = xy[i0]!, b = xy[Math.min(n - 1, i0 + 1)]!;
  const tete = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f] as const;
  const partiel = chemin([...xy.slice(0, i0 + 1), tete]);

  const i = Math.round(p);
  const point = d.serie[i]!;
  const precedent = i > 0 ? d.serie[i - 1]! : null;
  const derniere = i === n - 1;
  const valeur = derniere ? d.valeur : point.valeur;
  const variation = derniere ? d.variation : precedent ? (point.valeur / precedent.valeur - 1) * 100 : null;
  const plat = variation != null && Math.abs(variation) < 0.005;
  const x = (tete[0] / L) * 100;

  return (
    <div className="v-indice">
      <div className="v-indice-tete">
        <div>
          <p className="v-etiquette">BRVM Composite · {derniere ? `séance du ${fmtDateFR(point.date)}` : fmtDateFR(point.date)}</p>
          <p className="v-geant" aria-live="off">{fmtNumber(valeur, 2)}</p>
          <p className={`v-indice-var v-mono ${variation == null || plat ? '' : variation > 0 ? 'v-up' : 'v-down'}`}>
            {variation == null ? 'Début de la période' : plat ? '0,00 % sur la séance' : `${variation > 0 ? '▲' : '▼'} ${pctTexte(variation)} sur la séance`}
          </p>
        </div>
        {!calme && (
          <button type="button" className="v-bouton-second" onClick={rejouer}>
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            Rejouer les {n} séances
          </button>
        )}
      </div>
      <div ref={zone} className="v-indice-zone" onPointerMove={parcourir} onPointerDown={parcourir} onPointerLeave={() => setSurvol(null)}>
        <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label={`BRVM Composite sur les ${n} dernières séances, entre ${fmtNumber(d.bas, 2)} et ${fmtNumber(d.haut, 2)} points`}>
          <path d={chemin(xy)} fill="none" className="v-indice-fond" strokeWidth={1.2} strokeLinejoin="round" />
          <path d={partiel} fill="none" className="v-indice-trait" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span aria-hidden className="v-indice-guide" style={{ left: `${x}%` }} />
        <span aria-hidden className="v-indice-point" style={{ left: `${x}%`, top: `${(tete[1] / H) * 100}%` }} />
      </div>
      <div className="v-indice-pied v-mono">
        <span>plus bas {fmtNumber(d.bas, 2)}</span>
        <span>Séance {i + 1} / {n}</span>
        <span>plus haut {fmtNumber(d.haut, 2)}</span>
      </div>
      {releve && <p className="v-note">Source BRVM · {releve}</p>}
      <div className="relative">
        <table className="sr-only">
          <caption>BRVM Composite, clôtures des {n} dernières séances</caption>
          <thead><tr><th>Séance</th><th>Clôture</th></tr></thead>
          <tbody>{d.serie.map((s) => <tr key={s.date}><td>{fmtDateFR(s.date)}</td><td>{fmtNumber(s.valeur, 2)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
