/**
 * Lignes spécifiques AFFICHABLES dans un tableau en FCFA — PUR.
 *
 * Avenant du 2026-11-15 :
 *  - ETIT publie ses agrégats en USD. Une fois écrits dans lignes_specifiques
 *    (verrou ECRITURE_USD_AUTORISEE), ils ne doivent JAMAIS se glisser dans un
 *    tableau, une carte ou un prompt qui raisonne en FCFA : la clé dont la
 *    source (`sources_specifiques[clé].unite`) est en USD est retirée. Seule
 *    lib/bank/lecture.ts les affiche, en USD, avec leur source ;
 *  - le coefficient d'exploitation STOCKÉ n'est plus affiché nulle part :
 *    seul celui que calcule lib/bank/lecture.ts s'affiche. La valeur stockée
 *    reste lue par le scraper (contrôle de l'extraction).
 *
 * Appliqué par loadCompanyFinancials, le chargeur unique du tableau des
 * comptes, de la carte bancaire, du comparateur, de l'impression et du
 * diagnostic.
 */
export const CLES_JAMAIS_AFFICHEES: ReadonlySet<string> = new Set(['coefficient_exploitation']);

type Sources = Record<string, { unite?: string } | null | undefined> | null | undefined;

export function lignesAffichables<T>(ls: Record<string, T> | null | undefined, sources: Sources): Record<string, T> | null {
  if (!ls) return null;
  const out: Record<string, T> = {};
  for (const [cle, v] of Object.entries(ls)) {
    if (CLES_JAMAIS_AFFICHEES.has(cle)) continue;
    if (sources?.[cle]?.unite === 'usd') continue;
    out[cle] = v;
  }
  return out;
}

export function avecLignesAffichables<L extends { lignes_specifiques?: Record<string, unknown> | null; sources_specifiques?: unknown }>(l: L): L {
  return { ...l, lignes_specifiques: lignesAffichables(l.lignes_specifiques, l.sources_specifiques as Sources) };
}
