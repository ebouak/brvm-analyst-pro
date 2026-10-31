/** Pages dont la consultation (connectée) compte comme intérêt pour l'offre. */
export const PAGES_OFFRE = ['/pricing', '/account/plan', '/premium/upgrade'] as const;
export type PageOffre = (typeof PAGES_OFFRE)[number];
export const estPageOffre = (p: unknown): p is PageOffre => typeof p === 'string' && (PAGES_OFFRE as readonly string[]).includes(p);
