import { scrapeBulletins } from '../scrapers/bulletins.js';
import { upsertBulletins } from '../persistence/repository.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'runners:bulletins' });

export interface RunBulletinsResult {
  status: 'success' | 'failed';
  count: number;
  error?: string;
}

export async function runBulletins(): Promise<RunBulletinsResult> {
  try {
    log.info('Starting bulletins scrape and persist');

    const bulletins = await scrapeBulletins();
    log.info({ count: bulletins.length }, 'Bulletins scraped');

    if (bulletins.length === 0) {
      return { status: 'success', count: 0 };
    }

    const upserted = await upsertBulletins(bulletins);
    log.info({ upserted }, 'Bulletins persisted');

    return { status: 'success', count: upserted };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error({ err: errorMsg }, 'Bulletins runner failed');
    return { status: 'failed', count: 0, error: errorMsg };
  }
}
