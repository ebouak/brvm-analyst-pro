/**
 * Libellé d'un indicateur prudentiel ABSENT de la valeur retenue — module pur.
 *
 * « N/D » et « non publié » affirmaient une chose qu'on ne sait pas : qu'une
 * banque ne publie pas son ratio. Ce qu'on sait, c'est ce que disent les
 * observations d'`indicateur_source` pour CET exercice :
 *   * sources contradictoires (motif source_conflict) ;
 *   * seule une borne est publiée (« > 14 % ») ;
 *   * valeur publiée comme estimation ou approximation ;
 *   * non applicable ;
 *   * sinon : non trouvé dans les documents consultés.
 *
 * La valeur retenue elle-même est décidée côté scraper
 * (`scraper/src/prudentiel/selection.ts`) ; ce module n'explique que son
 * absence, et ne lit que l'exercice affiché — jamais un exercice voisin.
 */

export interface ObsStatut {
  date_arrete: string | null;
  statut: 'publie' | 'non_applicable' | 'non_trouve' | 'publie_non_exploitable' | string;
  motif: string | null;
  comparateur: string;
  valeur: number | string | null;
}

export const NON_TROUVE = 'non trouvé dans les documents consultés';

/** « 2025 » ou « 2025-12-31 » → date d'arrêté ; toute autre période → null. */
export function dateArrete(periode: string | null | undefined): string | null {
  if (!periode) return null;
  if (/^\d{4}$/.test(periode)) return `${periode}-12-31`;
  if (/^\d{4}-12-31$/.test(periode)) return periode;
  return null;
}

const nf = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export function libelleAbsence(obs: ObsStatut[], periode: string | null | undefined): string {
  const date = dateArrete(periode);
  const c = date ? obs.filter((o) => o.date_arrete === date) : [];
  if (c.some((o) => o.motif === 'source_conflict')) return 'publié mais non exploitable — sources contradictoires';
  const borne = c.find((o) => o.statut === 'publie' && o.comparateur !== '=' && o.valeur != null);
  if (borne) return `publié sous forme de borne (${borne.comparateur} ${nf(Number(borne.valeur))} %), sans valeur exacte`;
  if (c.some((o) => o.motif === 'estime')) return 'publié comme estimation — non retenu';
  if (c.some((o) => o.motif === 'approximation')) return 'publié en valeur approchée — non retenu';
  if (c.some((o) => o.statut === 'publie_non_exploitable')) return 'publié mais non exploitable';
  if (c.length && c.every((o) => o.statut === 'non_applicable')) return 'non applicable';
  return NON_TROUVE;
}
