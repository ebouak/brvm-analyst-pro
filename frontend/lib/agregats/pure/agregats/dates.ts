// COPIE GÉNÉRÉE de scraper/src/agregats/dates.ts par frontend/scripts/copier-agregats-purs.mjs — ne pas modifier ici.
/**
 * Dates d'arrêté des agrégats bancaires — PUR, sans dépendance.
 * exercice = 12 mois au 31/12 ; T1, S1, T3 = cumul depuis le début de
 * l'exercice au 31/03, 30/06, 30/09 (convention de src/interim/periode.ts).
 *
 * ⚠️ Copié dans frontend/lib/agregats/pure/ (scripts/copier-agregats-purs.mjs,
 * vérifié par copie.test.ts) : corriger ICI, puis relancer le script.
 */
export type CodePeriode = 'exercice' | 'S1' | 'T1' | 'T3';

const FIN: Record<CodePeriode, string> = { T1: '03-31', S1: '06-30', T3: '09-30', exercice: '12-31' };
const MOIS: Record<CodePeriode, number> = { T1: 3, S1: 6, T3: 9, exercice: 12 };

export const dateArreteDe = (annee: number, code: CodePeriode): string => `${annee}-${FIN[code]}`;
export const moisDe = (code: CodePeriode): number => MOIS[code];

export function periodeDeDate(date: string): CodePeriode | null {
  const fin = date.slice(5);
  const trouve = (Object.entries(FIN) as [CodePeriode, string][]).find(([, f]) => f === fin);
  return trouve ? trouve[0] : null;
}
