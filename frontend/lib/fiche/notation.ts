/**
 * Logique pure du bandeau « Notation financière » : rang d'une note, variation
 * entre deux notations, trois dernières notations, libellés. Aucune donnée
 * nouvelle : tout dérive de ce que la fiche reçoit déjà.
 */

// Échelle croissante : plus l'indice est haut, meilleure est la note.
const ECHELLE = [
  'D', 'C', 'CC', 'CCC-', 'CCC', 'CCC+',
  'B-', 'B', 'B+', 'BB-', 'BB', 'BB+',
  'BBB-', 'BBB', 'BBB+',
  'A-', 'A', 'A+', 'AA-', 'AA', 'AA+', 'AAA',
];

/** Rang d'une note long terme, ou null si elle n'est pas sur l'échelle. */
export function rangNote(note: string | null | undefined): number | null {
  if (!note) return null;
  const i = ECHELLE.indexOf(note.trim().toUpperCase());
  return i === -1 ? null : i;
}

export type Variation = 'hausse' | 'baisse' | 'stable' | null;

/** Variation de `actuelle` par rapport à `precedente` ; null si l'une est inconnue. */
export function variationNote(actuelle: string, precedente: string | null | undefined): Variation {
  const a = rangNote(actuelle);
  const p = rangNote(precedente);
  if (a == null || p == null) return null;
  return a > p ? 'hausse' : a < p ? 'baisse' : 'stable';
}

export interface EntreeNotation {
  note: string;
  perspective?: string | null;
  date_notation: string;
}

/** Les `n` plus récentes notations (tri par date décroissante), chacune avec sa variation. */
export function dernieresNotations<T extends EntreeNotation>(
  entrees: T[],
  n = 3,
): Array<T & { variation: Variation }> {
  const tri = [...entrees].sort((x, y) => y.date_notation.localeCompare(x.date_notation));
  return tri.slice(0, n).map((e, i) => ({
    ...e,
    // la variation se mesure contre la notation juste antérieure, même hors des n affichées
    variation: variationNote(e.note, tri[i + 1]?.note),
  }));
}

/** « Stable » / « Positive » / « Négative » ; chaîne vide si inconnue. */
export function libellePerspective(p: string | null | undefined): string {
  const v = (p ?? '').trim().toLowerCase();
  if (!v) return '';
  if (v === 'stable') return 'Stable';
  if (v.startsWith('pos')) return 'Positive';
  if (v.startsWith('n')) return 'Négative';
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/** Phrase de synthèse, dérivée de la note, de la perspective et de la tendance. */
export function syntheseNotation(note: string, perspective: string | null | undefined, historique: { note: string }[]): string {
  let niveau: string;
  if (note.startsWith('AAA')) niveau = 'qualité exceptionnelle';
  else if (note.startsWith('AA')) niveau = 'très haute qualité';
  else if (note.startsWith('A')) niveau = 'haute qualité';
  else if (note.startsWith('BBB')) niveau = 'qualité investment grade';
  else if (note.startsWith('BB')) niveau = 'catégorie spéculative';
  else niveau = 'risque élevé';

  const p = libellePerspective(perspective).toLowerCase();
  const persp = p ? `perspective ${p === 'négative' ? 'négative' : p}` : '';
  let phrase = `Notation ${niveau}${persp ? `, ${persp}` : ''}.`;

  if (historique.length >= 2) {
    const v = variationNote(historique[0].note, historique[1].note);
    if (v === 'hausse') phrase += ' Tendance en amélioration sur la période récente.';
    else if (v === 'baisse') phrase += ' Tendance en dégradation sur la période récente.';
    else if (v === 'stable') phrase += ' Notation stable sur la période récente.';
  }
  return phrase;
}

/** Logo officiel disponible dans le dépôt pour cette agence, sinon null (texte seul). */
export function logoAgence(agence: string): string | null {
  return /bloomfield/i.test(agence) ? '/brand/bloomfield-logo.png' : null;
}
