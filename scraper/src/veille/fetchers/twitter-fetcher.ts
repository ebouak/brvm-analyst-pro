import { logger } from '../../logger.js';
import type { VeilleDigestRow } from '../types.js';

/**
 * Fetch market news from Twitter/X
 * Note: Requires authentication for full API access
 * Fallback to mock data or public feeds if no API key available
 */
export async function fetchTwitterTrends(keywords: string[]): Promise<VeilleDigestRow[]> {
  const results: VeilleDigestRow[] = [];

  // Twitter/X API endpoints would require authentication
  // For now, use public search or Nitter fallback
  const twitterApiKey = process.env.TWITTER_API_KEY;
  const twitterApiSecret = process.env.TWITTER_API_SECRET;
  const twitterBearerToken = process.env.TWITTER_BEARER_TOKEN;

  if (!twitterBearerToken && !twitterApiKey) {
    logger.info(
      'Twitter API key not configured, using mock data'
    );
    return fetchTwitterTrendsMock();
  }

  // Search terms relevant to BRVM and trading
  const searchTerms = [
    '#BRVM',
    '#WestBourse',
    'BRVM trading',
    'intraday patterns',
    'fintech news',
  ];

  try {
    // If using Twitter API v2
    if (twitterBearerToken) {
      for (const term of searchTerms) {
        const url = new URL('https://api.twitter.com/2/tweets/search/recent');
        url.searchParams.append('query', term);
        url.searchParams.append('max_results', '10');
        url.searchParams.append(
          'tweet.fields',
          'created_at,author_id,public_metrics'
        );

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${twitterBearerToken}`,
          },
        });

        if (!response.ok) {
          logger.warn(
            { status: response.status, term },
            'Twitter API error'
          );
          continue;
        }

        const data = (await response.json()) as {
          data?: Array<{
            id: string;
            text: string;
            created_at: string;
            public_metrics?: {
              like_count?: number;
              retweet_count?: number;
            };
          }>;
        };

        for (const tweet of data.data || []) {
          results.push({
            source: 'twitter',
            category: 'news',
            title: tweet.text.substring(0, 100),
            summary: tweet.text.substring(0, 500),
            url: `https://twitter.com/i/web/status/${tweet.id}`,
            relevance_score: 0.6 + (tweet.public_metrics?.retweet_count || 0) / 100,
            sentiment: analyzeSentiment(tweet.text),
            tags: ['twitter', 'market-news', extractHashtags(tweet.text)].flat(),
            full_content: {
              created_at: tweet.created_at,
              metrics: tweet.public_metrics,
            },
            is_critical: false,
          });
        }
      }
    }
  } catch (err) {
    logger.error(
      { err },
      'Failed to fetch Twitter trends'
    );
  }

  return results;
}

/**
 * Mock Twitter data for development/testing
 */
export async function fetchTwitterTrendsMock(): Promise<VeilleDigestRow[]> {
  return [
    {
      source: 'twitter',
      category: 'news',
      title: 'BRVM closes +2.3% on strong tech rally',
      summary: 'BRVM-10 surges 2.3% as tech stocks lead gains. PALM and SGBC contribute +150bps.',
      url: 'https://twitter.com/search?q=BRVM',
      relevance_score: 0.85,
      sentiment: 'positive',
      tags: ['twitter', 'market-news', '#BRVM', '#tech'],
      full_content: { source: 'mock', timestamp: new Date().toISOString() },
      is_critical: false,
    },
    {
      source: 'twitter',
      category: 'news',
      title: 'West Africa fintech investment up 45% YoY',
      summary: 'UEMOA region sees record fintech funding rounds as digital banking expands.',
      url: 'https://twitter.com/search?q=fintech',
      relevance_score: 0.72,
      sentiment: 'positive',
      tags: ['twitter', 'market-news', '#fintech', '#UEMOA'],
      full_content: { source: 'mock', timestamp: new Date().toISOString() },
      is_critical: false,
    },
    {
      source: 'twitter',
      category: 'news',
      title: 'Trading halt: Liquidity maintenance at COSUMAF',
      summary: 'COSUMAF announces 2-hour trading halt for system maintenance Wednesday.',
      url: 'https://twitter.com/search?q=COSUMAF',
      relevance_score: 0.95,
      sentiment: 'neutral',
      tags: ['twitter', 'market-news', '#COSUMAF', '#alert'],
      full_content: { source: 'mock', timestamp: new Date().toISOString() },
      is_critical: true,
    },
  ];
}

/**
 * Simple sentiment analysis based on keywords
 */
function analyzeSentiment(
  text: string
): 'positive' | 'neutral' | 'negative' {
  const lower = text.toLowerCase();

  const positive = ['gain', 'surge', 'rally', 'bull', 'up', '+', 'strong', 'growth'];
  const negative = ['fall', 'crash', 'bear', 'down', '-', 'weak', 'loss', 'decline'];

  let posCount = 0;
  let negCount = 0;

  positive.forEach((word) => {
    if (lower.includes(word)) posCount++;
  });

  negative.forEach((word) => {
    if (lower.includes(word)) negCount++;
  });

  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  return 'neutral';
}

/**
 * Extract hashtags from tweet text
 */
function extractHashtags(text: string): string[] {
  const hashtags = text.match(/#\w+/g) || [];
  return hashtags.slice(0, 5); // Limit to 5 hashtags
}
