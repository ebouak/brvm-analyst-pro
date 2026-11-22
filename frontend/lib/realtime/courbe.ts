/**
 * Courbes du jour (une valeur, un indice, un portefeuille). Logique PURE,
 * testée. Chaque point est un relevé réel ; rien n'est interpolé entre deux
 * relevés : le tracé relie des points mesurés, il n'en ajoute aucun.
 */
import { HEURE_FIN_SEANCE_UTC } from '@/lib/freshness';
import type { ImageSeance } from './rejeu';

export interface PointCourbe {
  /** Instant du relevé, en millisecondes. */
  t: number;
  v: number;
}

/**
 * Points du jour à partir des relevés. Les relevés pris APRÈS la séance qui
 * répètent la dernière valeur sont écartés : ils étireraient l'axe du temps
 * jusqu'au soir sans rien apprendre. Un relevé tardif qui CHANGE la valeur
 * (clôture publiée plus tard) est gardé, à son heure réelle.
 */
export function pointsDuJour(
  releves: readonly { captured_at: string; valeur: number | string | null }[],
  finSeanceUtc = HEURE_FIN_SEANCE_UTC,
): PointCourbe[] {
  const tries = releves
    .map((r) => ({ t: Date.parse(r.captured_at), v: typeof r.valeur === 'string' ? Number(r.valeur) : r.valeur }))
    .filter((p): p is PointCourbe => Number.isFinite(p.t) && typeof p.v === 'number' && Number.isFinite(p.v) && p.v > 0)
    .sort((a, b) => a.t - b.t);
  const points: PointCourbe[] = [];
  for (const p of tries) {
    const heure = new Date(p.t).getUTCHours();
    const dernier = points[points.length - 1];
    if (heure >= finSeanceUtc && dernier && dernier.v === p.v) continue;
    if (dernier && dernier.t === p.t) continue;
    points.push(p);
  }
  return points;
}

/** Ajoute un point reçu en direct, s'il est plus récent que le dernier. */
export function ajouterPoint(points: readonly PointCourbe[], p: PointCourbe): PointCourbe[] {
  const dernier = points[points.length - 1];
  if (!Number.isFinite(p.v) || p.v <= 0) return points as PointCourbe[];
  if (dernier && p.t <= dernier.t) return points as PointCourbe[];
  return [...points, p];
}

/**
 * Valeur d'un portefeuille à chaque relevé de la séance : Σ quantité × cours.
 * Seules entrent les positions dont la clôture de la veille est connue (elle
 * sert de référence) ; avant son premier relevé, une valeur compte à son
 * cours de la veille.
 */
export function valeurPortefeuilleDuJour(
  positions: readonly { code: string; quantite: number }[],
  images: readonly ImageSeance[],
  veilles: Readonly<Record<string, number | null | undefined>>,
): { reference: number | null; points: PointCourbe[] } {
  const retenues = positions.filter((p) => (veilles[p.code] ?? null) != null && p.quantite > 0);
  if (retenues.length === 0) return { reference: null, points: [] };
  const reference = retenues.reduce((s, p) => s + p.quantite * (veilles[p.code] as number), 0);
  const points = images.map((img) => ({
    t: Date.parse(img.t),
    v: retenues.reduce((s, p) => s + p.quantite * (img.cours[p.code] ?? (veilles[p.code] as number)), 0),
  }));
  return { reference, points };
}

/**
 * Tracé SVG d'une courbe, à l'échelle : axe du temps de `debut` à `fin`
 * (par défaut le premier et le dernier point), axe des valeurs couvrant les
 * points ET la ligne de référence (veille), avec une marge.
 */
export function cheminCourbe(
  points: readonly PointCourbe[],
  o: { largeur: number; hauteur: number; marge?: number; reference?: number | null; debut?: number; fin?: number },
): { d: string; dernier: [number, number] | null; yReference: number | null; hausse: boolean | null } {
  const marge = o.marge ?? 4;
  if (points.length === 0) return { d: '', dernier: null, yReference: null, hausse: null };
  const debut = o.debut ?? points[0]!.t;
  const fin = Math.max(o.fin ?? points[points.length - 1]!.t, debut + 1);
  const valeurs = points.map((p) => p.v);
  if (o.reference != null) valeurs.push(o.reference);
  let min = Math.min(...valeurs);
  let max = Math.max(...valeurs);
  if (max === min) { min -= 1; max += 1; }
  const x = (t: number) => marge + ((t - debut) / (fin - debut)) * (o.largeur - 2 * marge);
  const y = (v: number) => marge + (1 - (v - min) / (max - min)) * (o.hauteur - 2 * marge);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const dp = points[points.length - 1]!;
  const ref = o.reference ?? points[0]!.v;
  return {
    d,
    dernier: [Number(x(dp.t).toFixed(1)), Number(y(dp.v).toFixed(1))],
    yReference: o.reference != null ? Number(y(o.reference).toFixed(1)) : null,
    hausse: dp.v === ref ? null : dp.v > ref,
  };
}
