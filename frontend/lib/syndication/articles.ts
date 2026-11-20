import { createPublicClient } from '@/lib/supabase/public';
import type { SyndicationArticle } from './types';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';
export const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000;

export const CORIS_ARTICLE: SyndicationArticle = {
  slug: 'coris-bank-ipo-2027',
  title: 'Coris Bank Côte d’Ivoire en bourse : l’étude de l’OPV à 7 720 FCFA',
  description: 'WESTBOURSE étudie l’OPV de Coris Bank Côte d’Ivoire (20 % à 7 720 FCFA, du 30 novembre au 4 décembre 2026) : offre, valorisation, dividendes attendus et effets sur la liquidité de la BRVM.',
  url: `${SITE_URL}/analyses/coris-bank-ipo-2027`,
  publishedAt: '2026-11-19T13:00:00.000Z',
  imageUrl: `${SITE_URL}/analyses/coris-bank-ipo-2027/opengraph-image`,
};

export function sortByPublishedAt(articles: SyndicationArticle[]): SyndicationArticle[] {
  return [...articles].sort((a, b) => {
    const left = new Date(a.publishedAt).getTime();
    const right = new Date(b.publishedAt).getTime();
    if (Number.isNaN(left) || Number.isNaN(right)) {
      throw new Error('Date invalide dans un article de syndication');
    }
    return right - left;
  });
}

export function newsArticlesSince(
  articles: SyndicationArticle[],
  now = new Date(),
): SyndicationArticle[] {
  const minimum = now.getTime() - NEWS_WINDOW_MS;
  return sortByPublishedAt(articles)
    .filter((article) => {
      const publishedAt = new Date(article.publishedAt).getTime();
      if (Number.isNaN(publishedAt)) throw new Error(`Date invalide : ${article.publishedAt}`);
      return publishedAt >= minimum && publishedAt <= now.getTime();
    })
    .slice(0, 1000);
}

export async function loadSyndicationArticles(limit = 50): Promise<SyndicationArticle[]> {
  const { data, error } = await createPublicClient()
    .from('articles')
    .select('slug,titre,chapo,publie_le')
    .eq('statut', 'publie')
    .not('publie_le', 'is', null)
    .order('publie_le', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Lecture du flux RSS impossible : ${error.message}`);

  const databaseArticles = (data ?? []).map((article) => {
    if (!article.slug || !article.titre || !article.chapo || !article.publie_le) {
      throw new Error('Article publié incomplet dans le flux RSS');
    }
    return {
      slug: article.slug,
      title: article.titre,
      description: article.chapo,
      url: `${SITE_URL}/actualites/${encodeURIComponent(article.slug)}`,
      publishedAt: article.publie_le,
      imageUrl: `${SITE_URL}/api/articles/${encodeURIComponent(article.slug)}/image`,
    };
  });

  const byUrl = new Map<string, SyndicationArticle>();
  for (const article of [...databaseArticles, CORIS_ARTICLE]) byUrl.set(article.url, article);
  return sortByPublishedAt([...byUrl.values()]).slice(0, limit);
}
