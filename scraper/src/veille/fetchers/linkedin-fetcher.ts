import { logger } from '../../logger.js';
import type { VeilleDigestRow } from '../types.js';

/**
 * Fetch competitor and industry intelligence from LinkedIn
 * Note: Full LinkedIn API requires special partnership agreement
 * Using mock data or public posts scraping (see note)
 */
export async function fetchLinkedInIntelligence(): Promise<VeilleDigestRow[]> {
  const results: VeilleDigestRow[] = [];

  const linkedinApiKey = process.env.LINKEDIN_API_KEY;

  if (!linkedinApiKey) {
    logger.info(
      'LinkedIn API key not configured, using mock data'
    );
    return fetchLinkedInIntelligenceMock();
  }

  // LinkedIn API would require official partnership
  // For now, return mock data
  logger.warn(
    'LinkedIn full API access requires special partnership. Using mock data.'
  );

  return fetchLinkedInIntelligenceMock();
}

/**
 * Mock LinkedIn data for development/testing
 * Represents competitor moves, industry news, etc.
 */
export async function fetchLinkedInIntelligenceMock(): Promise<VeilleDigestRow[]> {
  return [
    {
      source: 'linkedin',
      category: 'competitor',
      title: 'Fintech Startup X Raises $5M Series A Funding',
      summary:
        'New trading platform competitor launches with AI-powered pattern recognition. Targets BRVM investors.',
      url: 'https://linkedin.com/feed/update/competitor-funding',
      relevance_score: 0.8,
      sentiment: 'neutral',
      tags: ['linkedin', 'competitor', 'fintech', 'funding'],
      full_content: {
        source: 'mock',
        company: 'Fintech Startup X',
        funding_round: 'Series A',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      is_critical: false,
    },
    {
      source: 'linkedin',
      category: 'news',
      title: 'BRVM Executive Joins World Economic Forum Council',
      summary:
        'BRVM leadership recognized for innovation in African securities markets.',
      url: 'https://linkedin.com/feed/update/wef-brvm',
      relevance_score: 0.85,
      sentiment: 'positive',
      tags: ['linkedin', 'news', 'BRVM', 'leadership'],
      full_content: {
        source: 'mock',
        event: 'World Economic Forum',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      is_critical: false,
    },
    {
      source: 'linkedin',
      category: 'news',
      title: 'New Regulation: COSUMAF Tightens Compliance Requirements',
      summary:
        'Regulatory update affecting brokers and investment firms operating on BRVM.',
      url: 'https://linkedin.com/feed/update/cosumaf-regulation',
      relevance_score: 0.95,
      sentiment: 'neutral',
      tags: ['linkedin', 'regulation', 'COSUMAF'],
      full_content: {
        source: 'mock',
        regulator: 'COSUMAF',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      is_critical: true,
    },
  ];
}
