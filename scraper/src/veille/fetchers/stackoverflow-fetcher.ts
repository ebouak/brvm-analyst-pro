import { logger } from '../../logger.js';
import type { VeilleDigestRow } from '../types.js';

/**
 * Fetch technical solutions and tutorials from Stack Overflow
 * Uses Stack Overflow public API (no authentication required)
 */
export async function fetchStackOverflowSolutions(since: Date): Promise<VeilleDigestRow[]> {
  const results: VeilleDigestRow[] = [];

  // Tags related to technical analysis, trading, and finance
  const tags = ['technical-analysis', 'trading', 'python', 'finance', 'time-series'];

  const baseUrl = 'https://api.stackexchange.com/2.3/questions';
  const sinceTimestamp = Math.floor(since.getTime() / 1000);

  try {
    for (const tag of tags) {
      const url = new URL(baseUrl);
      url.searchParams.append('site', 'stackoverflow');
      url.searchParams.append('tagged', tag);
      url.searchParams.append('sort', 'votes');
      url.searchParams.append('order', 'desc');
      url.searchParams.append('pagesize', '10');
      url.searchParams.append('fromdate', sinceTimestamp.toString());
      url.searchParams.append('filter', '!9_bDE(N88');

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'BRVM-Veille/1.0',
        },
      });

      if (!response.ok) {
        logger.warn(
          { status: response.status, tag },
          'Stack Overflow API error'
        );
        continue;
      }

      const data = (await response.json()) as {
        items?: Array<{
          question_id: number;
          title: string;
          link: string;
          score: number;
          view_count: number;
          answer_count: number;
          tags: string[];
          creation_date: number;
        }>;
      };

      for (const question of data.items || []) {
        // Only include high-score questions (likely good solutions)
        if (question.score < 5) continue;

        results.push({
          source: 'stack_overflow',
          category: 'solution',
          title: question.title,
          summary: `${question.score} votes, ${question.answer_count} answers, viewed ${question.view_count} times`,
          url: question.link,
          relevance_score:
            Math.min(question.score / 100, 1.0) * 0.8,
          sentiment: 'neutral',
          tags: ['stackoverflow', ...question.tags.slice(0, 3)],
          full_content: {
            score: question.score,
            answers: question.answer_count,
            views: question.view_count,
            tags: question.tags,
          },
          is_critical: false,
        });
      }
    }
  } catch (err) {
    logger.error(
      { err },
      'Failed to fetch Stack Overflow solutions'
    );
  }

  return results;
}

/**
 * Mock Stack Overflow data for development/testing
 */
export async function fetchStackOverflowSolutionsMock(): Promise<VeilleDigestRow[]> {
  return [
    {
      source: 'stack_overflow',
      category: 'solution',
      title: 'How to calculate RSI (Relative Strength Index) in Python efficiently?',
      summary: '145 votes, 8 answers, viewed 23,450 times',
      url: 'https://stackoverflow.com/questions/example1',
      relevance_score: 0.9,
      sentiment: 'neutral',
      tags: ['stackoverflow', 'python', 'technical-analysis'],
      full_content: {
        score: 145,
        answers: 8,
        views: 23450,
        tags: ['python', 'pandas', 'technical-analysis', 'stock-market'],
      },
      is_critical: false,
    },
    {
      source: 'stack_overflow',
      category: 'solution',
      title: 'Detecting consolidation patterns in time series data',
      summary: '87 votes, 5 answers, viewed 12,340 times',
      url: 'https://stackoverflow.com/questions/example2',
      relevance_score: 0.75,
      sentiment: 'neutral',
      tags: ['stackoverflow', 'python', 'trading'],
      full_content: {
        score: 87,
        answers: 5,
        views: 12340,
        tags: ['python', 'pandas', 'pattern-recognition', 'trading'],
      },
      is_critical: false,
    },
    {
      source: 'stack_overflow',
      category: 'solution',
      title: 'Best practices for handling missing data in financial time series',
      summary: '102 votes, 6 answers, viewed 18,900 times',
      url: 'https://stackoverflow.com/questions/example3',
      relevance_score: 0.85,
      sentiment: 'neutral',
      tags: ['stackoverflow', 'python', 'time-series'],
      full_content: {
        score: 102,
        answers: 6,
        views: 18900,
        tags: ['python', 'pandas', 'time-series', 'data-cleaning'],
      },
      is_critical: false,
    },
  ];
}
