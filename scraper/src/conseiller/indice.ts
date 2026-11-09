import type { Donnees } from './types.js';

export const ENTREE_APRES_SEANCES = 20;

export interface Indice {
  /** Rendement simple du jour (0,005 = +0,5 %), aux dates où au moins une valeur entre. */
  rendements: Map<string, number>;
  /** Niveau cumulé (base 1), défini aux mêmes dates. */
  niveaux: Map<string, number>;
}

/**
 * Indice équipondéré reconstruit depuis les cours (spec §4). Une valeur entre
 * dans la moyenne du jour si elle a été échangée ce jour-là et si elle cote
 * depuis au moins 20 séances.
 */
export function indiceEquipondere(d: Donnees): Indice {
  const sommes = new Map<string, { s: number; n: number }>();
  for (const serie of d.series.values()) {
    for (let i = Math.max(1, ENTREE_APRES_SEANCES); i < serie.dates.length; i++) {
      if ((serie.volumes[i] ?? 0) <= 0) continue;
      // Un cours nul est un trou de collecte, pas un cours.
      if (serie.cours[i - 1]! <= 0 || serie.cours[i]! <= 0) continue;
      const r = serie.cours[i]! / serie.cours[i - 1]! - 1;
      const date = serie.dates[i]!;
      const acc = sommes.get(date) ?? { s: 0, n: 0 };
      acc.s += r;
      acc.n += 1;
      sommes.set(date, acc);
    }
  }
  const rendements = new Map<string, number>();
  const niveaux = new Map<string, number>();
  let niveau = 1;
  for (const date of d.calendrier) {
    const acc = sommes.get(date);
    if (!acc) continue;
    const r = acc.s / acc.n;
    rendements.set(date, r);
    niveau *= 1 + r;
    niveaux.set(date, niveau);
  }
  return { rendements, niveaux };
}

/** Performance composée de l'indice sur ]debut ; fin]. */
export function perfIndice(ind: Indice, calendrier: string[], debut: string, fin: string): number {
  let p = 1;
  for (const date of calendrier) {
    if (date <= debut || date > fin) continue;
    p *= 1 + (ind.rendements.get(date) ?? 0);
  }
  return p - 1;
}
