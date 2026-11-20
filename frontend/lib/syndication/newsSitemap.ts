import type { SyndicationArticle } from './types';
import { newsArticlesSince } from './articles';
import { escapeXml, toIsoDate } from './xml';

export function buildNewsSitemapXml(
  articles: SyndicationArticle[],
  now = new Date(),
): string {
  const urls = newsArticlesSince(articles, now).map((article) => `  <url>
    <loc>${escapeXml(article.url)}</loc>
    <news:news>
      <news:publication>
        <news:name>WESTBOURSE</news:name>
        <news:language>fr</news:language>
      </news:publication>
      <news:publication_date>${toIsoDate(article.publishedAt)}</news:publication_date>
      <news:title>${escapeXml(article.title)}</news:title>
    </news:news>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;
}
