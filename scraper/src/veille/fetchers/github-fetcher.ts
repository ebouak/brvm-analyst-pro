import { logger } from '../../logger.js';
import type { VeilleDigestRow } from '../types.js';

/**
 * Fetch BRVM-related GitHub issues and pull requests
 * Uses GitHub REST API (public, no auth required for basic queries)
 */
export async function fetchGitHubIssues(since: Date): Promise<VeilleDigestRow[]> {
  const results: VeilleDigestRow[] = [];

  // Search queries targeting fintech, trading, and BRVM repos
  const searchQueries = [
    'repo:ebouak/brvm-analyst-pro',
    'repo:freqtrade/freqtrade is:issue label:feature',
    'repo:pandas-dev/pandas is:issue finance',
    'q:BRVM+is:issue+created:>' + since.toISOString().split('T')[0],
  ];

  const baseUrl = 'https://api.github.com/search/issues';

  for (const query of searchQueries) {
    try {
      const url = new URL(baseUrl);
      url.searchParams.append('q', query);
      url.searchParams.append('per_page', '10');
      url.searchParams.append('sort', 'updated');

      const response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'BRVM-Veille/1.0',
        },
      });

      if (!response.ok) {
        logger.warn(
          { status: response.status, query },
          'GitHub API error'
        );
        continue;
      }

      const data = (await response.json()) as {
        items: Array<{
          title: string;
          body: string | null;
          html_url: string;
          state: string;
          labels: Array<{ name: string }>;
          comments: number;
        }>;
      };

      for (const issue of data.items || []) {
        const labels = issue.labels?.map((l) => l.name) || [];
        results.push({
          source: 'github',
          category: labels.some((l) => l.includes('bug')) ? 'bug' : 'news',
          title: issue.title,
          summary: issue.body?.substring(0, 500) || '',
          url: issue.html_url,
          relevance_score: 0.8,
          sentiment: 'neutral',
          tags: ['github', ...labels],
          full_content: {
            issue_state: issue.state,
            comments: issue.comments,
          },
          is_critical: labels.some((l) =>
            l.toLowerCase().includes('critical')
          ),
        });
      }
    } catch (err) {
      logger.error(
        { err, query },
        'Failed to fetch GitHub issues'
      );
    }
  }

  return results;
}

export async function fetchGitHubIssuesMock(): Promise<VeilleDigestRow[]> {
  return [
    {
      source: 'github',
      category: 'news',
      title: 'BRVM Analyst Pro: Intraday Pattern Detection Added',
      summary: 'New intraday pattern detection system for BRVM equities with 15-minute candles',
      url: 'https://github.com/ebouak/brvm-analyst-pro/issues/123',
      relevance_score: 0.95,
      sentiment: 'positive',
      tags: ['github', 'feature', 'intraday-patterns', 'BRVM'],
      full_content: { issue_state: 'open', comments: 5 },
      is_critical: false,
    },
    {
      source: 'github',
      category: 'bug',
      title: 'Freqtrade: Fix RSI calculation on low-volume stocks',
      summary: 'Correction for RSI calculation accuracy on stocks with low trading volume',
      url: 'https://github.com/freqtrade/freqtrade/issues/8456',
      relevance_score: 0.7,
      sentiment: 'neutral',
      tags: ['github', 'bug', 'rsi', 'volume'],
      full_content: { issue_state: 'closed', comments: 12 },
      is_critical: false,
    },
  ];
}
