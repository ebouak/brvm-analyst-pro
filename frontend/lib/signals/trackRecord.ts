/**
 * Bilan des signaux réellement émis — fonctions PURES, testées.
 *
 * Audit du 2026-11-13 : les « 10 derniers signaux haussiers réels » ne
 * portaient que sur 5 valeurs (BICB quatre fois, BOABF trois fois, sur des
 * séances voisines). Compter quatre fois le même épisode quadruple son poids
 * dans la moyenne. Et la performance était affichée BRUTE, alors que la page
 * méthodologie annonce 0,6 % de frais par transaction.
 */

/** Achat + vente à 0,6 % chacun (frais de courtage BRVM typiques, page méthodologie). */
export const FRAIS_ALLER_RETOUR_PCT = 1.2;

/** Un signal du même titre émis moins de 30 jours après le précédent prolonge le même épisode. */
export const FENETRE_EPISODE_JOURS = 30;

const jours = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;

/**
 * Garde la PREMIÈRE émission de chaque épisode : un signal est un nouvel
 * épisode si le titre n'a pas eu de signal dans les `fenetre` jours qui
 * précèdent. Rendu du plus récent au plus ancien.
 */
export function premieresEmissions<T extends { code: string; date_marche: string }>(lignes: T[], fenetre = FENETRE_EPISODE_JOURS): T[] {
  const asc = [...lignes].sort((a, b) => a.date_marche.localeCompare(b.date_marche));
  const dernierVu = new Map<string, string>();
  const gardes: T[] = [];
  for (const l of asc) {
    const prec = dernierVu.get(l.code);
    if (prec == null || jours(l.date_marche, prec) > fenetre) gardes.push(l);
    dernierVu.set(l.code, l.date_marche);
  }
  return gardes.reverse();
}

/** Performance nette de frais d'aller-retour ; null si la brute est inconnue. */
export function perfNette(perfBrutePct: number | null): number | null {
  return perfBrutePct == null ? null : perfBrutePct - FRAIS_ALLER_RETOUR_PCT;
}
