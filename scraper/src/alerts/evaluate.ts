/**
 * Logique pure d'évaluation d'une alerte vs un cours. Testable sans I/O.
 */
export type AlertType = 'prix_au_dessus' | 'prix_en_dessous' | 'variation';

export interface Evaluable {
  type: AlertType;
  seuil: number;
}

/**
 * Détermine si une alerte se déclenche.
 * @param last  dernier cours (ou variation % pour type 'variation')
 * @param variationPct variation du jour (%) pour le type 'variation'
 */
export function isTriggered(
  a: Evaluable,
  last: number | null,
  variationPct: number | null,
): boolean {
  if (a.type === 'prix_au_dessus') return last != null && last >= a.seuil;
  if (a.type === 'prix_en_dessous') return last != null && last <= a.seuil;
  if (a.type === 'variation') return variationPct != null && Math.abs(variationPct) >= a.seuil;
  return false;
}
