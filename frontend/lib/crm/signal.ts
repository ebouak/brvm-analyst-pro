/** Pages dont la consultation (connectée) compte comme intérêt pour l'offre. */
export const PAGES_OFFRE = ['/pricing', '/account/plan', '/premium/upgrade'] as const;
export type PageOffre = (typeof PAGES_OFFRE)[number];
export const estPageOffre = (p: unknown): p is PageOffre => typeof p === 'string' && (PAGES_OFFRE as readonly string[]).includes(p);

/**
 * Pages de la formation (Academy) : hub, niveau/cours, leçon 0, intégrale.
 * MÊME motif que le CHECK de `crm_signaux.page` (migration 0179) : tout écart
 * ferait rejeter l'écriture par la base, donc rien enregistrer en silence.
 */
export const MOTIF_PAGE_FORMATION = /^\/formations\/academy(\/[a-z0-9-]{1,80}){0,2}$/;
export const estPageFormation = (p: unknown): p is string => typeof p === 'string' && MOTIF_PAGE_FORMATION.test(p);

export type TypeSignal = 'offre_vue' | 'formation_vue';
/** Type de signal d'une page, ou null si la page n'est pas suivie. Le type est DÉRIVÉ de la page, jamais envoyé par le client. */
export const typeDePage = (p: unknown): TypeSignal | null =>
  estPageOffre(p) ? 'offre_vue' : estPageFormation(p) ? 'formation_vue' : null;
