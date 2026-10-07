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


/** Une observation d'`indicateur_source` avec son indicateur, pour les séries. */
export interface ObsIndicateur extends ObsStatut {
  indicateur: string;
}

const NON_RETENABLE = new Set(['source_conflict', 'estime', 'approximation', 'illisible', 'definition_incompatible']);

/**
 * Série annuelle d'un indicateur, au 31 décembre seulement. Une année n'a une
 * valeur que si ses observations publiées, exactes et non contestées donnent
 * TOUTES le même nombre ; sinon elle est absente — jamais tranchée ici. La
 * règle complète (arrondi publié, périmètre) vit côté scraper
 * (prudentiel/selection.ts) ; ce module ne fait qu'afficher.
 */
export function serieRetenue(obs: ObsIndicateur[], indicateur: string): { annee: string; valeur: number }[] {
  const parAnnee = new Map<string, Set<number>>();
  const exclues = new Set<string>();
  for (const o of obs) {
    if (o.indicateur !== indicateur || !o.date_arrete?.endsWith('-12-31')) continue;
    const annee = o.date_arrete.slice(0, 4);
    if (o.motif && NON_RETENABLE.has(o.motif)) { exclues.add(annee); continue; }
    if (o.statut !== 'publie' || o.comparateur !== '=' || o.valeur == null) continue;
    (parAnnee.get(annee) ?? parAnnee.set(annee, new Set()).get(annee)!).add(Number(o.valeur));
  }
  return [...parAnnee]
    .filter(([annee, vals]) => vals.size === 1 && !exclues.has(annee))
    .map(([annee, vals]) => ({ annee, valeur: [...vals][0]! }))
    .sort((a, b) => a.annee.localeCompare(b.annee));
}

const pcFr = (v: number) => `${v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;

/**
 * Ligne « qualité du portefeuille » pour le prompt du diagnostic : les taux
 * publiés par la banque, exercice par exercice. null si rien n'est publié.
 */
export function ligneQualiteActif(obs: ObsIndicateur[]): string | null {
  const taux = serieRetenue(obs, 'taux_creances_souffrance');
  const couv = serieRetenue(obs, 'couverture_creances_souffrance');
  if (!taux.length && !couv.length) return null;
  const fmt = (s: { annee: string; valeur: number }[]) => s.map((p) => `${p.annee} ${pcFr(p.valeur)}`).join(' · ');
  return [
    taux.length ? `Créances en souffrance / crédits (taux publié par la banque) : ${fmt(taux)}` : null,
    couv.length ? `Couverture des créances en souffrance (publiée) : ${fmt(couv)}` : null,
  ].filter(Boolean).join(' | ');
}
