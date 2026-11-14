/**
 * Budget de texte des feuilles de la Revue. PUR, testé.
 *
 * Une feuille A4 a une hauteur fixe : le débordement ferait rogner le contenu.
 * On choisit donc CE QUI ENTRE, jamais de couper une phrase : la synthèse est
 * écartée si elle dépasse le budget, puis les puces sont gardées dans l'ordre
 * tant que le total reste dans le budget (une puce n'est jamais tronquée).
 */
export const BUDGET_ACTIVITE = 260;

export interface PuceActivite { titre: string; detail: string }

export function planActivite(
  synthese: string | null,
  items: PuceActivite[],
  budget = BUDGET_ACTIVITE,
): { synthese: string | null; items: PuceActivite[]; omis: number } {
  let reste = budget;
  let s: string | null = null;
  if (synthese && synthese.length <= reste) { s = synthese; reste -= synthese.length; }
  const gardes: PuceActivite[] = [];
  for (const it of items) {
    const n = it.titre.length + it.detail.length;
    if (n > reste) break;
    gardes.push(it);
    reste -= n;
  }
  return { synthese: s, items: gardes, omis: items.length - gardes.length + (synthese && !s ? 1 : 0) };
}

/** Lignes facultatives du tableau annuel, retirées d'abord quand la feuille porte aussi l'activité. */
export const LIGNES_FACULTATIVES = new Set(['Résultat avant impôt', 'Total actif']);
