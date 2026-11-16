// Graphique avancé : comparaison en base 100 (calcul pur).
//
// Deux séries n'ont pas les mêmes dates : une valeur peu liquide ne cote pas
// tous les jours, et les indices n'existent en base que depuis mai 2026. La
// base commune est donc la PREMIÈRE date de la fenêtre où les DEUX séries ont
// un point ; chaque série est rebasée sur sa propre valeur à cette date.
// Sans date commune, il n'y a pas de comparaison (et on le dit).

export interface Point {
  date: string;
  valeur: number;
}

export interface Base100 {
  dateBase: string;
  principale: Point[];
  comparee: Point[];
}

export function base100(
  principale: readonly Point[],
  comparee: readonly Point[],
  debut: string | null,
  fin: string | null,
): Base100 | null {
  const dans = (p: Point) => (debut == null || p.date >= debut) && (fin == null || p.date <= fin) && p.valeur > 0;
  const a = principale.filter(dans);
  const b = comparee.filter(dans);
  if (a.length === 0 || b.length === 0) return null;
  const datesB = new Set(b.map((p) => p.date));
  const dateBase = a.find((p) => datesB.has(p.date))?.date;
  if (!dateBase) return null;
  const refA = a.find((p) => p.date === dateBase)!.valeur;
  const refB = b.find((p) => p.date === dateBase)!.valeur;
  const rebaser = (s: Point[], ref: number) =>
    s.filter((p) => p.date >= dateBase).map((p) => ({ date: p.date, valeur: (p.valeur / ref) * 100 }));
  return { dateBase, principale: rebaser(a, refA), comparee: rebaser(b, refB) };
}

/** Écart de performance en points de base 100 à la dernière date commune. */
export function ecartFinal(r: Base100): { date: string; principale: number; comparee: number } | null {
  const datesB = new Map(r.comparee.map((p) => [p.date, p.valeur]));
  for (let i = r.principale.length - 1; i >= 0; i--) {
    const p = r.principale[i]!;
    const v = datesB.get(p.date);
    if (v != null) return { date: p.date, principale: p.valeur, comparee: v };
  }
  return null;
}

/**
 * Rebase une série ENTIÈRE sur sa valeur à `dateBase` (base 100), sans couper
 * les points antérieurs : le graphique garde tout son axe des temps, et la
 * base suit la fenêtre affichée. `null` si la série n'a pas de point à cette date.
 */
export function rebaserTout(serie: readonly Point[], dateBase: string): Point[] | null {
  const ref = serie.find((p) => p.date === dateBase)?.valeur;
  if (ref == null || ref <= 0) return null;
  return serie.map((p) => ({ date: p.date, valeur: (p.valeur / ref) * 100 }));
}

/**
 * Aligne une série comparée sur les dates des barres affichées : pour chaque
 * barre, la dernière valeur comparée de date ≤ la barre ET dans la même
 * période (même séance, même semaine ou même mois). Aucun report d'une
 * période sur l'autre : une barre sans point comparé reste sans valeur.
 */
export function alignerSur(
  dates: readonly string[],
  serie: readonly Point[],
  memePeriode: (a: string, b: string) => boolean,
): Point[] {
  const out: Point[] = [];
  let j = 0;
  let dernier: Point | null = null;
  for (const d of dates) {
    while (j < serie.length && serie[j]!.date <= d) {
      dernier = serie[j]!;
      j += 1;
    }
    if (dernier && memePeriode(dernier.date, d)) out.push({ date: d, valeur: dernier.valeur });
  }
  return out;
}
