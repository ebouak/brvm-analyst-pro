/**
 * Fraîcheur des indices pan-africains — fonctions PURES, testées.
 *
 * POURQUOI. La collecte AFX n'a jamais fonctionné en CI (136 échecs sur 136
 * depuis le 04/07) : la table `african_indices_daily` s'est arrêtée aux
 * 02-03/07, et `AfricanIndicesCard` affichait ces valeurs SANS leur date, comme
 * si c'était la séance du jour. Une donnée vieille de deux mois et demi
 * présentée sans âge est une donnée fausse.
 *
 * Seuil de 4 jours calendaires : un week-end plus un jour férié ne doivent pas
 * déclencher l'alerte ; une semaine de silence, si.
 */

export const SEUIL_PERIME_JOURS = 4;

/** Nombre de jours calendaires (UTC) entre la date de marché et maintenant. */
export function ageEnJours(dateMarche: string, maintenant: Date): number {
  const d = Date.UTC(
    Number(dateMarche.slice(0, 4)),
    Number(dateMarche.slice(5, 7)) - 1,
    Number(dateMarche.slice(8, 10)),
  );
  const m = Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate());
  return Math.round((m - d) / 86_400_000);
}

/** Vrai si la donnée est trop ancienne pour être présentée comme actuelle. Sans date : périmée. */
export function estPerime(dateMarche: string | null | undefined, maintenant: Date, seuil = SEUIL_PERIME_JOURS): boolean {
  if (!dateMarche) return true;
  return ageEnJours(dateMarche, maintenant) > seuil;
}

/** Date la plus récente d'un ensemble (chaînes ISO AAAA-MM-JJ), ou null. */
export function plusRecente(dates: readonly (string | null | undefined)[]): string | null {
  let max: string | null = null;
  for (const d of dates) if (d && (!max || d > max)) max = d;
  return max;
}
