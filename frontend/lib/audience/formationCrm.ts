/** Intérêt pour la formation côté CRM (notre base) — PUR. Comptes distincts, jamais de noms. */
import { continentDe, estUemoa } from '../crm/geo';
import type { FormationCrm } from './types';

export function repartirFormation(userIds: string[], paysParUser: Map<string, string | null>): FormationCrm {
  const uniques = [...new Set(userIds)];
  let afrique = 0, uemoa = 0, inconnu = 0;
  for (const id of uniques) {
    const p = paysParUser.get(id) ?? null;
    const c = continentDe(p);
    if (c === null) inconnu++;
    if (c === 'Afrique') afrique++;
    if (estUemoa(p)) uemoa++;
  }
  return { comptes: uniques.length, afrique, uemoa, paysInconnu: inconnu };
}
