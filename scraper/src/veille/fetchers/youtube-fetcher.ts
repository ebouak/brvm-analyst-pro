import { logger } from '../../logger.js';
import type { VeilleDigestRow } from '../types.js';

/**
 * Fetch educational content and trading tutorials from YouTube
 * Requires YouTube API key (free tier available)
 */
export async function fetchYouTubeTutorials(keywords: string[]): Promise<VeilleDigestRow[]> {
  const results: VeilleDigestRow[] = [];

  const youtubeApiKey = process.env.YOUTUBE_API_KEY;

  if (!youtubeApiKey) {
    // JAMAIS de mock en mode réel (données inventées → interdites en base).
    logger.warn('YouTube : clé absente → source ignorée (aucune donnée)');
    return [];
  }

  // Search for trading and technical analysis tutorials
  const searchTerms = [
    'intraday trading patterns',
    'technical analysis tutorial',
    'RSI MACD indicators',
    'stock market consolidation',
  ];

  const baseUrl = 'https://www.googleapis.com/youtube/v3/search';

  try {
    for (const term of searchTerms) {
      const url = new URL(baseUrl);
      url.searchParams.append('q', term);
      url.searchParams.append('part', 'snippet');
      url.searchParams.append('maxResults', '5');
      url.searchParams.append('order', 'relevance');
      url.searchParams.append('publishedAfter', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      url.searchParams.append('key', youtubeApiKey);
      url.searchParams.append('type', 'video');

      const response = await fetch(url.toString());

      if (!response.ok) {
        logger.warn(
          { status: response.status, term },
          'YouTube API error'
        );
        continue;
      }

      const data = (await response.json()) as {
        items?: Array<{
          id: { videoId: string };
          snippet: {
            title: string;
            description: string;
            publishedAt: string;
            channelTitle: string;
          };
        }>;
      };

      for (const item of data.items || []) {
        results.push({
          source: 'youtube',
          category: 'tutorial',
          title: item.snippet.title,
          summary: item.snippet.description?.substring(0, 200) || '',
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          relevance_score: 0.7,
          sentiment: 'neutral',
          tags: ['youtube', 'tutorial', term.split(' ')[0]],
          full_content: {
            channel: item.snippet.channelTitle,
            published: item.snippet.publishedAt,
            videoId: item.id.videoId,
          },
          is_critical: false,
        });
      }
    }
  } catch (err) {
    logger.error(
      { err },
      'Failed to fetch YouTube tutorials'
    );
  }

  return results;
}

/**
 * Mock YouTube data for development/testing
 */
export async function fetchYouTubeTutorialsMock(): Promise<VeilleDigestRow[]> {
  return [
    {
      source: 'youtube',
      category: 'tutorial',
      title: 'Intraday Trading Patterns: Complete Guide for Beginners',
      summary:
        'Learn how to identify and trade consolidation, breakout, and reversal patterns in intraday timeframes. Perfect for day traders.',
      url: 'https://www.youtube.com/watch?v=example1',
      relevance_score: 0.85,
      sentiment: 'neutral',
      tags: ['youtube', 'tutorial', 'intraday-patterns'],
      full_content: {
        channel: 'Trading Academy',
        published: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        videoId: 'example1',
      },
      is_critical: false,
    },
    {
      source: 'youtube',
      category: 'tutorial',
      title: 'Technical Analysis Masterclass: RSI & MACD Indicators',
      summary:
        'Deep dive into RSI and MACD indicators. Learn best practices and avoid common mistakes.',
      url: 'https://www.youtube.com/watch?v=example2',
      relevance_score: 0.8,
      sentiment: 'neutral',
      tags: ['youtube', 'tutorial', 'technical-analysis'],
      full_content: {
        channel: 'Chartmaster Pro',
        published: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        videoId: 'example2',
      },
      is_critical: false,
    },
    {
      source: 'youtube',
      category: 'tutorial',
      title: 'Day Trading in African Markets: BRVM & WAMZ',
      summary:
        'Specific strategies for trading on the BRVM exchange and West African regional markets.',
      url: 'https://www.youtube.com/watch?v=example3',
      relevance_score: 0.95,
      sentiment: 'positive',
      tags: ['youtube', 'tutorial', 'BRVM'],
      full_content: {
        channel: 'Africa Traders Hub',
        published: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        videoId: 'example3',
      },
      is_critical: false,
    },
  ];
}
