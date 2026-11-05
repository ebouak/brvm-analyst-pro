/**
 * Délai accordé à UN appel de la cascade LLM (callAgentLlm). Module PUR.
 *
 * Sans échéance : 30 s par appel, le comportement historique (Telegram, e-mail).
 *
 * Avec échéance (assistant WhatsApp) : le temps restant avant l'échéance,
 * plafonné à 60 s pour qu'un fournisseur qui ne répond pas laisse sa chance au
 * suivant. Mesuré le 2026-11-05 : DeepSeek et Gemini à court de crédit (402),
 * Grok seul a mis 23,7 s à rédiger une comparaison SNTS/ORAC — en production
 * il dépassait les 30 s fixes, et la question partait à la console.
 *
 * null : il reste trop peu de temps pour qu'un appel aboutisse — on s'arrête
 * plutôt que de lancer une requête condamnée.
 */
export const DELAI_APPEL_MS = 30_000;
export const DELAI_APPEL_MAX_MS = 60_000;
export const RESTE_MIN_MS = 3_000;

export function delaiAppel(maintenant: number, echeance?: number): number | null {
  if (echeance === undefined) return DELAI_APPEL_MS;
  const reste = echeance - maintenant;
  if (reste < RESTE_MIN_MS) return null;
  return Math.min(reste, DELAI_APPEL_MAX_MS);
}
