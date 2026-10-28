/**
 * Plafond de 3 POSTS par jour sur la Chaîne et le canal : au-delà, un abonné
 * se lasse. Quand les articles dépassent ce qui reste, le dernier post
 * disponible les regroupe (« Les faits du jour »).
 */
export const PLAFOND_POSTS_JOUR = 3;

export interface ArticleDiffusable {
  slug: string;
  titre: string;
  chapo: string;
}

export function planDiffusion<T extends ArticleDiffusable>(
  nouveaux: T[],
  postsDejaFaits: number,
): { individuels: T[]; groupe: T[]; ignores: T[] } {
  const restants = Math.max(0, PLAFOND_POSTS_JOUR - postsDejaFaits);
  if (restants === 0) return { individuels: [], groupe: [], ignores: nouveaux };
  if (nouveaux.length <= restants) return { individuels: nouveaux, groupe: [], ignores: [] };
  return { individuels: nouveaux.slice(0, restants - 1), groupe: nouveaux.slice(restants - 1), ignores: [] };
}

export function legende(a: ArticleDiffusable, site: string): string {
  return `📰 *${a.titre}*\n\n${a.chapo}\n\n${site}/actualites/${a.slug}`;
}

export function legendeGroupe(as: ArticleDiffusable[], site: string): string {
  return ['📰 *Les faits du jour — WESTBOURSE*', '', ...as.map((a) => `• ${a.titre}\n  ${site}/actualites/${a.slug}`)].join('\n');
}
