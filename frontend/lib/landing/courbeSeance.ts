/**
 * Tracé SVG de la courbe du hero, rendu côté serveur : aucun graphique client au
 * premier écran. Fonction pure, testée.
 *
 * L'échelle est celle des points réellement tracés : le plus bas touche le bas de
 * la zone, le plus haut touche le haut. Moins de deux points : rien, plutôt qu'une
 * ligne plate qui laisserait croire à un marché immobile.
 */
export interface PointCourbe {
  d: string;
  v: number;
}

export interface Courbe {
  ligne: string;
  aire: string;
  finX: number;
  finY: number;
  min: number;
  max: number;
}

export function courbeSeance(points: PointCourbe[], largeur: number, hauteur: number, marge = 8): Courbe | null {
  const valeurs = points.filter((p) => Number.isFinite(p.v) && p.v > 0);
  if (valeurs.length < 2) return null;
  const vs = valeurs.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const amplitude = max - min || 1;
  const pas = largeur / (valeurs.length - 1);
  const xy = valeurs.map((p, i) => ({
    x: Math.round(i * pas * 10) / 10,
    y: Math.round((hauteur - marge - ((p.v - min) / amplitude) * (hauteur - marge * 2)) * 10) / 10,
  }));
  const ligne = xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const fin = xy[xy.length - 1]!;
  return { ligne, aire: `${ligne} L${fin.x} ${hauteur} L0 ${hauteur} Z`, finX: fin.x, finY: fin.y, min, max };
}

/** Répartition de la séance, en % arrondis qui totalisent exactement 100. */
export function largeurMarche(hausses: number, stables: number, baisses: number): { hausses: number; stables: number; baisses: number } | null {
  const total = hausses + stables + baisses;
  if (total <= 0) return null;
  const h = Math.round((hausses / total) * 100);
  const b = Math.round((baisses / total) * 100);
  return { hausses: h, stables: 100 - h - b, baisses: b };
}
