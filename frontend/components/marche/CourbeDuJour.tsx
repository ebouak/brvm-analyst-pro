'use client';

import { useEffect, useMemo, useState } from 'react';
import { ajouterPoint, cheminCourbe, type PointCourbe } from '@/lib/realtime/courbe';
import { fmtNumber } from '@/lib/format';

const heure = (t: number) => {
  const d = new Date(t);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

/**
 * Courbe du jour d'une valeur, d'un indice ou d'un portefeuille.
 *
 * - Chaque point est un relevé réel de la collecte (toutes les 15 min) ; le
 *   tracé relie des points mesurés, il n'en invente aucun entre deux.
 * - Elle se dessine à l'arrivée ; pendant la séance, `direct` ajoute le cours
 *   reçu et le dernier point s'éclaire.
 * - La ligne pointillée est la clôture de la veille (`reference`) : la courbe
 *   est verte au-dessus, rouge en dessous.
 * - Moins de deux points : rien n'est affiché (une courbe d'un point ne dit
 *   rien). C'est le cas des indices avant leur premier jour de relevés.
 */
export default function CourbeDuJour({
  points,
  reference = null,
  libelleReference = 'veille',
  direct = null,
  largeur = 320,
  hauteur = 72,
  decimales = 0,
  unite = '',
  libelle,
  className = '',
  compacte = false,
}: {
  points: PointCourbe[];
  reference?: number | null;
  libelleReference?: string;
  direct?: PointCourbe | null;
  largeur?: number;
  hauteur?: number;
  decimales?: number;
  unite?: string;
  /** Ce que mesure la courbe, pour le lecteur d'écran (« Cours de SNTS »). */
  libelle: string;
  className?: string;
  /** Version réduite (indices) : sans libellés d'heure ni de référence. */
  compacte?: boolean;
}) {
  const [pts, setPts] = useState(points);
  useEffect(() => { setPts(points); }, [points]);
  useEffect(() => {
    if (direct) setPts((p) => ajouterPoint(p, direct));
  }, [direct]);

  const c = useMemo(() => cheminCourbe(pts, { largeur, hauteur, reference, marge: 5 }), [pts, largeur, hauteur, reference]);
  if (pts.length < 2 || !c.dernier) return null;

  const premier = pts[0]!;
  const dernier = pts[pts.length - 1]!;
  const ton = c.hausse == null ? 'text-muted' : c.hausse ? 'text-up' : 'text-down';
  const fmt = (v: number) => `${fmtNumber(v, decimales)}${unite ? ` ${unite}` : ''}`;
  const resume =
    `${libelle} pendant la séance : de ${fmt(premier.v)} à ${heure(premier.t)} UTC ` +
    `à ${fmt(dernier.v)} à ${heure(dernier.t)} UTC, ${pts.length} relevés` +
    (reference != null ? `, clôture de la veille ${fmt(reference)}.` : '.');

  return (
    <figure className={`m-0 ${className}`}>
      <svg
        viewBox={`0 0 ${largeur} ${hauteur}`}
        width="100%"
        role="img"
        aria-label={resume}
        className={`block overflow-visible ${ton}`}
      >
        {c.yReference != null && (
          <line
            x1={0} x2={largeur} y1={c.yReference} y2={c.yReference}
            className="stroke-border" strokeWidth={1} strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path
          d={c.d}
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth={compacte ? 1.5 : 2}
          strokeLinejoin="round"
          strokeLinecap="round"
          // PAS de vector-effect="non-scaling-stroke" ici : combiné à
          // pathLength, Chrome calcule mal le pointillé de l'animation et le
          // tracé s'arrête avant le dernier point (constaté en production).
          className="courbe-trace"
        />
        <circle
          key={dernier.t}
          cx={c.dernier[0]} cy={c.dernier[1]} r={compacte ? 2.5 : 3.5}
          fill="currentColor"
          className="courbe-point"
        />
      </svg>
      {!compacte && (
        <figcaption className="mt-1 flex items-center justify-between gap-2 text-[11px] text-faint tabular">
          <span>{heure(premier.t)} UTC</span>
          {reference != null && <span>{libelleReference} {fmt(reference)}</span>}
          <span>{heure(dernier.t)} UTC</span>
        </figcaption>
      )}
    </figure>
  );
}
