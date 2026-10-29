import { createPublicClient } from '@/lib/supabase/public';
import { choisirUne, type ArticleLanding } from './articlesUne';

/**
 * Articles publiés pour la landing. Clé anon : la RLS de 0167 ne laisse voir
 * que les publiés, un brouillon ne peut pas fuiter ici. Toute erreur rend une
 * liste vide — la section disparaît, la landing ne tombe jamais pour elle.
 */
export async function getArticlesLanding(): Promise<{ une: ArticleLanding | null; autres: ArticleLanding[] }> {
  try {
    const { data, error } = await createPublicClient()
      .from('articles')
      .select('slug, type, code, titre, chapo, date_fait, publie_le')
      .order('publie_le', { ascending: false })
      .limit(12);
    if (error) return { une: null, autres: [] };
    return choisirUne((data ?? []) as ArticleLanding[], new Date());
  } catch {
    return { une: null, autres: [] };
  }
}
