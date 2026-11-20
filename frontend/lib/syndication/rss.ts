import type { SyndicationArticle } from './types';
import { escapeXml, toRfc822 } from './xml';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export function buildRssXml(articles: SyndicationArticle[], now = new Date()): string {
  const items = articles.map((article) => `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(article.url)}</link>
      <guid isPermaLink="true">${escapeXml(article.url)}</guid>
      <pubDate>${toRfc822(article.publishedAt)}</pubDate>
      <description>${escapeXml(article.description)}</description>
      <media:thumbnail url="${escapeXml(article.imageUrl)}" type="image/png" />
      <enclosure url="${escapeXml(article.imageUrl)}" type="image/png" length="0" />
    </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>WESTBOURSE — Actualités et analyses</title>
    <link>${SITE_URL}/actualites</link>
    <description>Analyses originales, données de marché et décryptages de la BRVM.</description>
    <language>fr</language>
    <lastBuildDate>${toRfc822(now.toISOString())}</lastBuildDate>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}
