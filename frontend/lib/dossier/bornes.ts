/**
 * Bornes d'affichage des contenus VARIABLES du dossier — module PUR et testé.
 *
 * Chaque feuille A4 a une hauteur fixe de 297 mm et le worker d'impression refuse
 * un dossier qui déborde. Plutôt que de découvrir le débordement le samedi, les
 * listes de longueur libre (réserves, dates, hypothèses) sont bornées ici, et
 * ce qui est omis est DIT (« … et N autres »), jamais rogné en silence.
 */

export const BORNES = {
  /** Feuille 17 : réserves listées sous « Ce que ce dossier ne dit pas ». */
  lacunes: 3,
  /** Feuille 17 : dates affichées par type de document. */
  datesParFamille: 4,
  /** Feuille 8 : notes variables sous les hypothèses du placement (hors les trois fixes). */
  notesPlacement: 1,
  /** Feuille 8 : exercices écartés nommés sous la bande de PER. */
  ecartesBande: 3,
  /** Feuille 3 : points d'appui et de vigilance chiffrés, par côté, sous la lecture d'ensemble. */
  pointsLecture: 2,
} as const;

export interface ListeBornee<T> {
  affichees: T[];
  omis: number;
}

export function borner<T>(items: T[], max: number): ListeBornee<T> {
  const m = Math.max(0, Math.floor(max));
  return { affichees: items.slice(0, m), omis: Math.max(0, items.length - m) };
}

/** « … et 1 autre », « … et 3 autres » (nom au masculin ou au féminin selon `genre`). */
export function phraseOmis(n: number, nom: string, genre: 'm' | 'f' = 'm'): string | null {
  if (n <= 0) return null;
  const autre = n > 1 ? 'autres' : genre === 'f' ? 'autre' : 'autre';
  return `… et ${n} ${autre} ${nom}${n > 1 ? 's' : ''}`;
}
