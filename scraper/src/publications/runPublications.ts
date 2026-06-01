import { logger } from '../logger.js';
import { upsertPublications } from './repository.js';
import { buildMockPublications } from './mock.js';
import { runPublicationsBrowser } from './runPublicationsBrowser.js';

export interface PubsRunResult {
  status: 'success' | 'failed' | 'mock';
  count: number;
  message?: string;
}

export async function runPublications(opts: { mock?: boolean } = {}): Promise<PubsRunResult> {
  if (opts.mock) {
    const pubs = buildMockPublications();
    const n = await upsertPublications(pubs);
    logger.info({ count: n }, 'Publications mock ingerees');
    return { status: 'mock', count: n };
  }
  const res = await runPublicationsBrowser();
  return res;
}
