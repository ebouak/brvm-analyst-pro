/**
 * PER glissant et bande de PER sur plusieurs exercices — module PUR et testé
 * (per.test.ts).
 *
 * MÊME DÉFINITION QUE LE PER DU DOSSIER : cours ÷ (résultat net ÷ nombre d'actions
 * actuel). Les cours de la base sont ajustés des opérations sur titres : avec le
 * nombre d'actions d'AUJOURD'HUI, le PER d'un ancien exercice reste cohérent.
 * Limite assumée et écrite sous le graphique : un nombre d'actions qui aurait
 * changé SANS ajustement des cours (augmentation de capital en numéraire) fausse
 * le PER des exercices antérieurs.
 *
 * Une perte n'a pas de PER : l'exercice est écarté et COMPTÉ, pas tracé à zéro.
 */

export interface PointCloture { date: string; close: number }

/** PER sur douze mois glissants ; null si un terme manque ou si le résultat est ≤ 0. */
export function perGlissant(e: {
  cours: number | null;
  titres: number | null;
  resultatGlissant: number | null;
}): number | null {
  const { cours, titres, resultatGlissant } = e;
  if (cours == null || titres == null || resultatGlissant == null) return null;
  if (!(cours > 0) || !(titres > 0) || !(resultatGlissant > 0)) return null;
  return cours / (resultatGlissant / titres);
}

export interface PointBande {
  exercice: number;
  /** Cours de la dernière séance de l'exercice. */
  cours: number;
  date_cours: string;
  per: number;
}

export interface BandePer {
  points: PointBande[];
  /** Exercices écartés, avec la raison : une perte, ou l'absence de cours à la fin de l'exercice. */
  ecartes: { exercice: number; raison: 'perte' | 'cours' }[];
  min: number;
  max: number;
  mediane: number;
  /** Situation du PER actuel dans la fourchette ; null sans PER actuel. */
  situation: 'sous' | 'dans' | 'au-dessus' | null;
  /** Position dans la fourchette, de 0 (minimum) à 1 (maximum), bornée ; null sans PER actuel. */
  position: number | null;
}

/** En dessous, une « bande » n'en est pas une. */
export const POINTS_MIN_BANDE = 3;
/** Le dernier cours d'un exercice ne doit pas dater de plus de dix jours avant sa clôture. */
const ECART_MAX_JOURS = 10;

function medianeDe(v: number[]): number {
  const t = [...v].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m]! : (t[m - 1]! + t[m]!) / 2;
}

const jours = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/**
 * `exercices` : exercices ANNUELS (période « 2025 »), dans n'importe quel ordre.
 * `serie` : clôtures du titre, de la plus ancienne à la plus récente.
 */
export function bandePer(e: {
  exercices: { periode: string; resultat_net: number | null }[];
  titres: number | null;
  serie: PointCloture[];
  perActuel: number | null;
  nombre?: number;
}): BandePer | null {
  const nombre = e.nombre ?? 5;
  if (e.titres == null || !(e.titres > 0)) return null;
  const annuels = e.exercices
    .filter((x) => /^\d{4}$/.test(x.periode))
    .map((x) => ({ exercice: Number(x.periode), resultat_net: x.resultat_net }))
    .sort((a, b) => b.exercice - a.exercice)
    .slice(0, nombre);

  const points: PointBande[] = [];
  const ecartes: BandePer['ecartes'] = [];
  for (const x of annuels) {
    if (x.resultat_net == null || !(x.resultat_net > 0)) {
      ecartes.push({ exercice: x.exercice, raison: 'perte' });
      continue;
    }
    const cloture = `${x.exercice}-12-31`;
    const dernier = [...e.serie].reverse().find((p) => p.date <= cloture && p.close > 0);
    if (!dernier || jours(dernier.date, cloture) > ECART_MAX_JOURS) {
      ecartes.push({ exercice: x.exercice, raison: 'cours' });
      continue;
    }
    points.push({
      exercice: x.exercice,
      cours: dernier.close,
      date_cours: dernier.date,
      per: dernier.close / (x.resultat_net / e.titres),
    });
  }
  if (points.length < POINTS_MIN_BANDE) return null;
  points.sort((a, b) => a.exercice - b.exercice);

  const pers = points.map((p) => p.per);
  const min = Math.min(...pers);
  const max = Math.max(...pers);
  const actuel = e.perActuel != null && e.perActuel > 0 ? e.perActuel : null;
  return {
    points,
    ecartes,
    min,
    max,
    mediane: medianeDe(pers),
    situation: actuel == null ? null : actuel < min ? 'sous' : actuel > max ? 'au-dessus' : 'dans',
    position: actuel == null || max === min ? null : Math.min(1, Math.max(0, (actuel - min) / (max - min))),
  };
}
