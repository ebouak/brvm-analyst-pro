/**
 * Construction d'une mini-courbe SVG à partir d'une série de clôtures réelles.
 *
 * Fonction pure et testable, sans dépendance : les mini-courbes des « Top 5
 * hausses / baisses » de la landing sont tracées à partir des vraies clôtures
 * de `brvm_actions_daily`, jamais d'une courbe décorative. Une série trop
 * courte (< 2 points) ne produit rien plutôt qu'un trait inventé.
 *
 * Les couleurs ne sont PAS décidées ici : le composant applique `currentColor`
 * et hérite de `text-up` / `text-down`, ce qui garde la courbe correcte dans
 * les deux thèmes.
 */

export interface SparklineGeometry {
  /** Tracé de la ligne (attribut `d` d'un <path>). */
  line: string;
  /** Même tracé refermé sur la ligne de base, pour l'aplat sous la courbe. */
  area: string;
}

export function sparklinePath(values: number[], width: number, height: number): SparklineGeometry | null {
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) return null;

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  // Série plate (tous les cours identiques) : on centre la ligne au lieu de
  // diviser par zéro. C'est fréquent à la BRVM, où beaucoup de titres ne
  // s'échangent pas pendant plusieurs séances.
  const range = max - min || 1;
  const pad = 1.5;
  const usable = height - pad * 2;
  const stepX = width / (pts.length - 1);
  const y = (v: number) => (max === min ? height / 2 : height - pad - ((v - min) / range) * usable);

  const coords = pts.map((v, i) => `${(i * stepX).toFixed(2)},${y(v).toFixed(2)}`);
  const line = `M${coords.join(' L')}`;
  return { line, area: `${line} L${width.toFixed(2)},${height} L0,${height} Z` };
}
