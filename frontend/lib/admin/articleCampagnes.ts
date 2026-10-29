import type { getServiceClient } from '@/lib/billing/serviceClient';
import type { CampagneArticle } from '@/lib/email/articleEmail';

type Db = ReturnType<typeof getServiceClient>;

/**
 * Traces d'envoi email des articles listés. Table absente (migration 0169 non
 * appliquée) → carte vide : la page s'affiche, et c'est le bouton d'envoi qui
 * dira qu'il manque la migration.
 */
export async function chargerCampagnes(db: Db, ids: string[]): Promise<Map<string, CampagneArticle>> {
  const carte = new Map<string, CampagneArticle>();
  if (ids.length === 0) return carte;
  const { data, error } = await db
    .from('article_campagnes')
    .select('article_id, statut, destinataires, envoyes, lance_le')
    .in('article_id', ids);
  if (error) return carte;
  for (const l of (data ?? []) as (CampagneArticle & { article_id: string })[]) carte.set(l.article_id, l);
  return carte;
}

export async function compterAbonnesConfirmes(db: Db): Promise<number> {
  const { count } = await db.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('confirmed', true);
  return count ?? 0;
}
