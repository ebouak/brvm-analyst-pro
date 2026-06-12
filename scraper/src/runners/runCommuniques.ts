import { scrapeCommuniques } from '../scrapers/communiques.js';
import { upsertCommuniques } from '../persistence/repository.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'runners:communiques' });

export interface RunCommuniquesResult {
  status: 'success' | 'failed';
  count: number;
  error?: string;
}

export async function runCommuniques(): Promise<RunCommuniquesResult> {
  try {
    log.info('Starting communiqués scrape and persist');

    const communiques = await scrapeCommuniques();
    log.info({ count: communiques.length }, 'Communiqués scraped');

    if (communiques.length === 0) {
      return { status: 'success', count: 0 };
    }

    const upserted = await upsertCommuniques(communiques);
    log.info({ upserted }, 'Communiqués persisted');

    return { status: 'success', count: upserted };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error({ err: errorMsg }, 'Communiqués runner failed');
    return { status: 'failed', count: 0, error: errorMsg };
  }
}
