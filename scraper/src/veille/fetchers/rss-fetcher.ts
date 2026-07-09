import { logger } from '../../logger.js';
import type { VeilleDigestRow } from '../types.js';

/**
 * Fetch financial and economic news from RSS feeds
 * Note: Requires rss-parser package or manual XML parsing
 */
export async function fetchRSSFeeds(since: Date): Promise<VeilleDigestRow[]> {
  const results: VeilleDigestRow[] = [];

  // Flux RSS finance / économie AFRIQUE, gratuits et vérifiés (200 + items).
  // (Les flux mondiaux Yahoo/Bloomberg/Reuters/FT étaient morts ou payants et
  //  hors-sujet BRVM.) Objectif : veille MARCHÉ, sans aucune clé payante.
  const feeds = [
    { url: 'https://www.financialafrik.com/feed/', category: 'afrique_finance' },
    { url: 'https://www.jeuneafrique.com/feed/', category: 'afrique_eco' },
    { url: 'https://www.rfi.fr/fr/afrique/rss', category: 'afrique' },
    { url: 'https://www.rfi.fr/fr/économie/rss', category: 'economie' },
  ];

  // Beaucoup de flux renvoient 403 sans User-Agent navigateur.
  const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

  for (const feed of feeds) {
    try {
      const response = await fetch(feed.url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        logger.warn(
          { status: response.status, url: feed.url },
          'RSS feed fetch error'
        );
        continue;
      }

      const text = await response.text();
      const items = parseRSSItems(text);

      for (const item of items) {
        // Filter by date
        if (new Date(item.pubDate || 0) < since) continue;

        // Assess relevance
        const isRelevant = isRelevantToFinance(item.title + ' ' + (item.description || ''));

        if (isRelevant) {
          results.push({
            source: 'rss',
            category: feed.category === 'financial_news' ? 'news' : 'news',
            title: item.title,
            summary: item.description?.substring(0, 300) || '',
            url: item.link,
            relevance_score: 0.65,
            sentiment: 'neutral',
            tags: ['rss', feed.category],
            full_content: {
              feed_url: feed.url,
              published: item.pubDate,
            },
            is_critical: false,
          });
        }
      }
    } catch (err) {
      logger.error(
        { err, url: feed.url },
        'Failed to fetch RSS feed'
      );
    }
  }

  return results;
}

/**
 * Parse RSS items from XML
 * Simple implementation using regex (ideally use rss-parser library)
 */
function parseRSSItems(xml: string): Array<{
  title: string;
  description?: string;
  link?: string;
  pubDate?: string;
}> {
  const items: Array<{
    title: string;
    description?: string;
    link?: string;
    pubDate?: string;
  }> = [];

  // Extract items using regex
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemContent = match[1];

    const titleMatch = itemContent.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    const descMatch = itemContent.match(/<description[^>]*>([\s\S]*?)<\/description>/);
    const linkMatch = itemContent.match(/<link[^>]*>([\s\S]*?)<\/link>/);
    const pubDateMatch = itemContent.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/);

    if (titleMatch) {
      items.push({
        title: stripHtml(titleMatch[1]),
        description: descMatch ? stripHtml(descMatch[1]) : undefined,
        link: linkMatch ? stripHtml(linkMatch[1]) : undefined,
        pubDate: pubDateMatch ? stripHtml(pubDateMatch[1]) : undefined,
      });
    }
  }

  return items;
}

/**
 * Strip HTML tags from text
 */
function stripHtml(text: string): string {
  return text
    // Déballer les CDATA AVANT de retirer les balises (sinon <![CDATA[titre]]>
    // est capturé comme une balise et le titre est effacé).
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

/**
 * Check if content is relevant to finance/trading
 */
function isRelevantToFinance(text: string): boolean {
  // Mots-clés FR + BRVM/UEMOA (les sources sont francophones) + quelques EN.
  const keywords = [
    // BRVM / UEMOA / marché régional
    'brvm', 'uemoa', 'bceao', 'bourse', 'cotation', 'action', 'dividende',
    'obligation', 'indice', 'introduction en bourse', 'sgi', 'fcfa', 'cfa',
    'sonatel', 'ecobank', 'abidjan', 'dakar', 'côte d’ivoire', 'sénégal',
    // finance / éco générale
    'finance', 'économie', 'économique', 'investissement', 'banque',
    'assurance', 'inflation', 'taux', 'marché', 'croissance', 'pib',
    'cacao', 'coton', 'pétrole', 'or', 'matière première', 'devise',
    // quelques termes EN
    'market', 'stock', 'trading', 'investment', 'exchange', 'commodity',
  ];

  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/**
 * Mock RSS data for development/testing
 */
export async function fetchRSSFeedsMock(): Promise<VeilleDigestRow[]> {
  return [
    {
      source: 'rss',
      category: 'news',
      title: 'Central Bank raises interest rates by 25 basis points',
      summary:
        'BECEAO announces rate hike amid inflation concerns in West African region.',
      url: 'https://example.com/news/rate-hike',
      relevance_score: 0.95,
      sentiment: 'neutral',
      tags: ['rss', 'financial_news', 'rates'],
      full_content: {
        feed_url: 'https://feeds.finance.yahoo.com',
        published: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      is_critical: false,
    },
    {
      source: 'rss',
      category: 'news',
      title: 'Tech stocks surge as AI funding reaches record levels',
      summary:
        'Venture capital investment in African tech companies up 60% year-over-year.',
      url: 'https://example.com/news/tech-surge',
      relevance_score: 0.75,
      sentiment: 'positive',
      tags: ['rss', 'financial_news', 'tech'],
      full_content: {
        feed_url: 'https://feeds.finance.yahoo.com',
        published: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      is_critical: false,
    },
    {
      source: 'rss',
      category: 'news',
      title: 'Manufacturing output declines in Q2',
      summary:
        'UEMOA region manufacturing PMI falls below 50, signaling contraction.',
      url: 'https://example.com/news/manufacturing',
      relevance_score: 0.85,
      sentiment: 'negative',
      tags: ['rss', 'financial_news', 'economic'],
      full_content: {
        feed_url: 'https://feeds.finance.yahoo.com',
        published: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      is_critical: false,
    },
  ];
}
