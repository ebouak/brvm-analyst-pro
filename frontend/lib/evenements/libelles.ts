/**
 * Libellés français des types et sources d'événements : table UNIQUE du site.
 * Les valeurs brutes de la base (`resultats`, `info_permanente`…) ne s'affichent jamais telles quelles.
 */

export const TYPES_EVENEMENT: Record<string, string> = {
  resultats: 'Résultats',
  resultat: 'Résultat',
  dividende: 'Dividende',
  dividendes: 'Dividendes',
  assemblee: 'Assemblée générale',
  admission: 'Admission à la cote',
  suspension: 'Suspension de cotation',
  notation: 'Notation financière',
  gouvernance: 'Gouvernance',
  liquidite: 'Contrat de liquidité',
  operation: 'Opération sur titres',
  operations: 'Opérations sur titres',
  publication: 'Publication',
  communique: 'Communiqué',
  nomination: 'Nomination',
  autre: 'Autre',
};

/** Types proposés dans les filtres, dans l'ordre d'affichage. */
export const TYPES_FILTRABLES = [
  'resultats', 'dividende', 'assemblee', 'notation', 'gouvernance', 'liquidite', 'admission', 'suspension', 'autre',
] as const;

export const SOURCES_EVENEMENT: Record<string, string> = {
  communique: 'Communiqué',
  avis: 'Avis',
  info_permanente: 'Information permanente',
  rapport: 'Rapport',
  bulletin: 'Bulletin officiel',
  publication: 'Publication',
};

function repli(t: string): string {
  const propre = t.replace(/[_-]+/g, ' ');
  return propre.charAt(0).toUpperCase() + propre.slice(1);
}

/** Type d'événement brut (« resultats ») → libellé accentué (« Résultats »). */
export function libelleEvenement(type: string | null | undefined): string {
  const t = (type ?? '').trim();
  if (!t) return '';
  return TYPES_EVENEMENT[t.toLowerCase()] ?? repli(t);
}

/** Source brute (« info_permanente ») → « Information permanente ». */
export function libelleSource(source: string | null | undefined): string {
  const t = (source ?? '').trim();
  if (!t) return '';
  return SOURCES_EVENEMENT[t.toLowerCase()] ?? repli(t);
}
