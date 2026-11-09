import type { Dividende, Serie } from './types.js';

export const TOLERANCE_MONTANT = 0.2;

/**
 * Ex-date reconstituée (spec §3.5a, §11.4) : première séance de date comprise
 * entre `apres` et `jusqua` (inclus) où la baisse de cours vaut le montant à ±20 %.
 */
export function reconstituerExDate(s: Serie, montant: number, apres: string, jusqua: string): string | null {
  const debut = s.dates.findIndex((d) => d >= apres);
  if (debut < 0 || montant <= 0) return null;
  for (let i = Math.max(1, debut); i < s.dates.length && s.dates[i]! <= jusqua; i++) {
    const baisse = s.cours[i - 1]! - s.cours[i]!;
    if (baisse > 0 && Math.abs(baisse - montant) <= TOLERANCE_MONTANT * montant) return s.dates[i]!;
  }
  return null;
}

/** Chevauchement d'intervalles fermés de dates ISO. */
export const chevauchePeriode = (debut: string, fin: string, p1: string, p2: string) => debut <= p2 && fin >= p1;

/**
 * Rendement total entre les positions `a` et `b` (cours + dividendes détachés
 * dans ]a ; b]). `null` (observation EXCLUE, spec §3.5b) si un dividende de la
 * valeur, connu avant la fin de la fenêtre, n'a pas d'ex-date et que la fenêtre
 * chevauche mai-août de l'année N+1 de l'exercice (seule année où il peut détacher).
 * `null` aussi (spec §11.3) si une rupture non expliquée tombe dans ]dates[a] ; dates[b]].
 */
export function rendementTotal(s: Serie, code: string, dividendes: Dividende[], a: number, b: number, ruptures?: Set<string>): number | null {
  // Un cours nul est un trou de collecte, pas un cours.
  if (s.cours[a]! <= 0 || s.cours[b]! <= 0) return null;
  const debut = s.dates[a]!;
  const fin = s.dates[b]!;
  if (ruptures) for (const r of ruptures) if (r > debut && r <= fin) return null;
  let detache = 0;
  for (const dv of dividendes) {
    if (dv.code !== code) continue;
    if (dv.exDate == null) {
      if (dv.disponibleLe <= fin && chevauchePeriode(debut, fin, `${dv.exercice + 1}-05-01`, `${dv.exercice + 1}-08-31`)) return null;
      continue;
    }
    if (dv.exDate > debut && dv.exDate <= fin) detache += dv.montant;
  }
  return (s.cours[b]! + detache) / s.cours[a]! - 1;
}
