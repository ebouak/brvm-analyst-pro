/**
 * Revues de résultats mises à jour depuis le précédent envoi — PUR, testé.
 *
 * Aucun envoi immédiat à l'ingestion d'un événement : la mise à jour d'une
 * Revue est signalée dans le message hebdomadaire EXISTANT, donc soumise au
 * même consentement et à la même idempotence. Ce module ne fait que croiser
 * les valeurs détenues avec les publications de résultats récentes.
 */

export interface PublicationResultats {
  code: string;
  /** Date de l'événement `resultats` (AAAA-MM-JJ). */
  date_evenement: string;
}

export interface RevueMiseAJour {
  code: string;
  designation: string;
  /** Date de la publication à l'origine de la mise à jour (AAAA-MM-JJ). */
  publie_le: string;
}

/** Fenêtre d'un envoi à l'autre : l'envoi est hebdomadaire. */
export const FENETRE_REVUES_JOURS = 7;

/**
 * Pour chaque valeur détenue, la publication de résultats la plus récente de la
 * fenêtre. Une valeur sans publication récente n'apparaît pas ; l'ordre est
 * celui des valeurs détenues (déjà trié par valorisation).
 */
export function revuesMisesAJour(
  detenues: { code: string; designation: string }[],
  publications: PublicationResultats[],
): RevueMiseAJour[] {
  const derniere = new Map<string, string>();
  for (const p of publications) {
    const d = derniere.get(p.code);
    if (!d || p.date_evenement > d) derniere.set(p.code, p.date_evenement);
  }
  const vus = new Set<string>();
  const out: RevueMiseAJour[] = [];
  for (const v of detenues) {
    const publie = derniere.get(v.code);
    if (!publie || vus.has(v.code)) continue;
    vus.add(v.code);
    out.push({ code: v.code, designation: v.designation, publie_le: publie });
  }
  return out;
}
