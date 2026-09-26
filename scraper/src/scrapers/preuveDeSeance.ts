/**
 * Preuve de séance pour l'intraday — fonction PURE, testée.
 *
 * brvm.org ne porte AUCUNE date sur la page des cours (vérifié le 2026-09-21 :
 * zéro « jj/mm/aaaa » dans 56 ko). `runIntraday` datait donc le snapshot avec
 * « aujourd'hui ». Avant les premiers échanges — et toute la journée un jour
 * férié — la page affiche encore la séance précédente : le 2026-09-21 à
 * 09:01 UTC, les 47 lignes de vendredi ont été écrites sous la date du lundi.
 *
 * Faute de date lisible, la preuve vient de la DONNÉE : si chaque ligne du
 * snapshot est strictement identique (cours, variation, volume) à la
 * dernière séance en base, la page n'a pas basculé. Une vraie séance sans
 * aucun échange sur 47 titres reproduirait des volumes NULS, pas les volumes
 * de la veille — l'égalité stricte des volumes est le signal fiable.
 */

export interface LigneComparable {
  code: string;
  cours_jour: number | null;
  variation_pct: number | null;
  volume: number | null;
}

export interface VerdictSeance {
  /** true = la page montre encore la séance précédente : ne rien écrire. */
  memeSeance: boolean;
  identiques: number;
  comparees: number;
  raison: string;
}

const num = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : Number(v));

/**
 * @param snapshot   lignes parsées maintenant
 * @param precedente lignes de la dernière séance EN BASE (date < aujourd'hui)
 */
export function memeSeanceQuePrecedente(snapshot: readonly LigneComparable[], precedente: readonly LigneComparable[]): VerdictSeance {
  if (snapshot.length === 0) return { memeSeance: false, identiques: 0, comparees: 0, raison: 'snapshot vide' };
  if (precedente.length === 0) return { memeSeance: false, identiques: 0, comparees: 0, raison: 'aucune séance précédente en base' };
  const prev = new Map(precedente.map((r) => [r.code, r]));
  let comparees = 0;
  let identiques = 0;
  for (const r of snapshot) {
    const p = prev.get(r.code);
    if (!p) continue;
    comparees++;
    if (num(r.cours_jour) === num(p.cours_jour) && num(r.variation_pct) === num(p.variation_pct) && num(r.volume) === num(p.volume)) identiques++;
  }
  // Seuil : TOUTES les lignes comparées identiques, et au moins 10 comparées
  // (un marché de 47 titres ; en dessous, la comparaison ne prouve rien).
  const memeSeance = comparees >= 10 && identiques === comparees;
  return {
    memeSeance,
    identiques,
    comparees,
    raison: memeSeance
      ? `${identiques}/${comparees} lignes identiques à la séance précédente : la page n'a pas basculé`
      : `${identiques}/${comparees} identiques — séance nouvelle`,
  };
}
