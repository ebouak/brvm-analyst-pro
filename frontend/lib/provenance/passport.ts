/**
 * Passeport de donnée — assemblage PUR.
 *
 * Ne fait aucune requête : la page charge les lignes, ce module les assemble.
 * Règle constante : une provenance absente donne `non_trace` et un document
 * `null` — on n'invente jamais une source.
 *
 * Voir docs/superpowers/specs/2026-07-23-passeport-donnee-design.md
 */

export type Confiance = 'verifie' | 'extrait' | 'non_trace';

export interface ProvenanceRow {
  code: string;
  periode: string;
  table_cible: string;
  publication_id: string | null;
  extrait_le: string | null;
  extracteur: string | null;
  confiance: Confiance;
}

export interface PublicationRow {
  id: string;
  libelle: string | null;
  date_publication: string;
  source_url: string | null;
}

export interface Passeport {
  confiance: Confiance;
  document: { libelle: string; datePublication: string; url: string | null } | null;
  extraitLe: string | null;
  extracteur: string | null;
  conversion: { devise: string; taux: number } | null;
}

/**
 * Assemble le passeport d'un exercice.
 *
 * @param prov   ligne de provenance_exercice, ou null si l'exercice n'en a pas
 * @param pub    publication référencée, ou null si absente / non résolue
 * @param devise colonnes de conversion portées par cash_flow_statements
 */
export function buildPassport(
  prov: ProvenanceRow | null,
  pub: PublicationRow | null,
  devise: { devise_origine?: string | null; taux_conversion?: number | null } | null,
): Passeport {
  // La conversion vit sur cash_flow_statements, indépendamment de la provenance :
  // elle reste affichable même pour un exercice non tracé.
  const conversion =
    devise?.devise_origine && devise.taux_conversion != null
      ? { devise: devise.devise_origine, taux: devise.taux_conversion }
      : null;

  if (!prov) {
    return { confiance: 'non_trace', document: null, extraitLe: null, extracteur: null, conversion };
  }

  // Le document n'est rendu que si la publication a été résolue ET porte un
  // libellé : un lien sans intitulé n'apprend rien au lecteur.
  const document =
    pub && pub.libelle
      ? { libelle: pub.libelle, datePublication: pub.date_publication, url: pub.source_url }
      : null;

  return {
    confiance: prov.confiance,
    document,
    extraitLe: prov.extrait_le,
    extracteur: prov.extracteur,
    conversion,
  };
}

/**
 * Une correction promeut l'exercice à `verifie` UNIQUEMENT si elle cite une
 * source externe. Une correction technique interne — un bug d'extraction réparé —
 * ne vérifie rien et laisse la confiance inchangée.
 */
export function doitPromouvoir(sourceExterne: string | null | undefined): boolean {
  return typeof sourceExterne === 'string' && sourceExterne.trim().length > 0;
}
