import type { BillingCycle } from './types';

/**
 * Date de prochaine échéance (ISO) : +1 mois, +3 mois ou +1 an à partir de
 * `start`. Pure et déterministe.
 *
 * `setMonth` reporte au mois suivant quand le jour n'existe pas (31 janvier
 * + 1 mois = 3 mars). C'est le comportement de JavaScript, et il ne prive
 * personne d'un jour d'abonnement : on préfère offrir que retrancher.
 */
export function computeRenewsAt(start: Date, cycle: BillingCycle): string {
  const d = new Date(start.getTime());
  if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else if (cycle === 'quarterly') d.setMonth(d.getMonth() + 3);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

/**
 * Prix du plan pour un cycle donné. `null` = ce plan n'offre pas ce cycle —
 * l'appelant doit refuser la souscription plutôt que retomber sur un autre
 * prix, sans quoi on encaisserait un montant que personne n'a choisi.
 */
export function prixDuCycle(
  plan: { price_monthly?: number | null; price_quarterly?: number | null; price_yearly?: number | null },
  cycle: BillingCycle,
): number | null {
  const v = cycle === 'yearly' ? plan.price_yearly : cycle === 'quarterly' ? plan.price_quarterly : plan.price_monthly;
  return v == null ? null : Number(v);
}
