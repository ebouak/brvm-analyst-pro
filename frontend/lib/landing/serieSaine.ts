export interface PointSerie { d: string; v: number }

/**
 * Garde-fou sur une série d'indice : un saut > 10 % d'une séance à l'autre est
 * impossible pour un indice de marché — c'est un trou de collecte ou une ligne
 * fausse (constaté le 2026-09-22 : BRVMC au 25/05 à 285,31 contre 421,02 le
 * lendemain). On COUPE la série au dernier point sain plutôt que de tracer ou
 * de calculer une performance sur une valeur fausse.
 */
export function serieSaine<P extends PointSerie>(points: P[], sautMax = 0.10): P[] {
  for (let i = points.length - 1; i > 0; i--) {
    const a = points[i - 1].v, b = points[i].v;
    if (a <= 0 || Math.abs(b / a - 1) > sautMax) return points.slice(i);
  }
  return points;
}

