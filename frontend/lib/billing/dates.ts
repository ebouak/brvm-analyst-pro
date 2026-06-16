import type { BillingCycle } from './types';

/**
 * Date de prochaine échéance (ISO) : +1 mois (mensuel) ou +1 an (annuel)
 * à partir de `start`. Pure et déterministe.
 */
export function computeRenewsAt(start: Date, cycle: BillingCycle): string {
  const d = new Date(start.getTime());
  if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}
