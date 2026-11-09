import type { Dividende, Serie } from './types.js';

export const FENETRE_RECONSTITUTION = 60;
export const TOLERANCE_MONTANT = 0.2;

/**
 * Ex-date reconstituée (spec §3.5a) : première séance, dans les 60 séances qui
 * suivent `apres`, où la baisse de cours vaut le montant à ±20 %.
 */
export function reconstituerExDate(s: Serie, montant: number, apres: string): string | null {
  const debut = s.dates.findIndex((d) => d >= apres);
  if (debut < 0 || montant <= 0) return null;
  const fin = Math.min(s.dates.length - 1, debut + FENETRE_RECONSTITUTION);
  for (let i = Math.max(1, debut); i <= fin; i++) {
    const baisse = s.cours[i - 1]! - s.cours[i]!;
    if (baisse > 0 && Math.abs(baisse - montant) <= TOLERANCE_MONTANT * montant) return s.dates[i]!;
  }
  return null;
}

const chevaucheMaiAout = (debut: string, fin: string) => {
  for (let an = Number(debut.slice(0, 4)); an <= Number(fin.slice(0, 4)); an++) {
    if (debut <= `${an}-08-31` && fin >= `${an}-05-01`) return true;
  }
  return false;
};

/**
 * Rendement total entre les positions `a` et `b` (cours + dividendes détachés
 * dans ]a ; b]). `null` (observation EXCLUE, spec §3.5b) si un dividende de la
 * valeur, connu avant la fin de la fenêtre, n'a pas d'ex-date et que la fenêtre
 * chevauche mai-août.
 */
export function rendementTotal(s: Serie, code: string, dividendes: Dividende[], a: number, b: number): number | null {
  const debut = s.dates[a]!;
  const fin = s.dates[b]!;
  let detache = 0;
  for (const dv of dividendes) {
    if (dv.code !== code) continue;
    if (dv.exDate == null) {
      if (dv.disponibleLe <= fin && chevaucheMaiAout(debut, fin)) return null;
      continue;
    }
    if (dv.exDate > debut && dv.exDate <= fin) detache += dv.montant;
  }
  return (s.cours[b]! + detache) / s.cours[a]! - 1;
}
