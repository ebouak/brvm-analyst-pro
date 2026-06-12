// scraper/src/runners/runBdfinInstruments.ts
import { scrapeBdfinInstruments } from '../scrapers/bdfin/instruments.js';
import { upsertInstruments } from '../persistence/repository.js';
import type { HeadlessBrowser } from '../headless/types.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'runners:bdfin:instruments' });

export interface RunBdfinInstrumentsResult {
  status: 'success' | 'partial' | 'failed';
  count: number;
  error?: string;
}

export async function runBdfinInstruments(browser: HeadlessBrowser): Promise<RunBdfinInstrumentsResult> {
  try {
    log.info('Starting BDFIN instruments scrape and persist');

    // Scrape
    const scrapeResult = await scrapeBdfinInstruments(browser);
    if (scrapeResult.status === 'failed') {
      log.error({ error: scrapeResult.error }, 'BDFIN instruments scrape failed');
      return { status: 'failed', count: 0, error: scrapeResult.error };
    }

    const instruments = scrapeResult.instruments ?? [];
    log.info({ count: instruments.length }, 'Instruments scraped successfully');

    // Persist
    const upsertResult = await upsertInstruments(instruments);
    log.info({ upserted: upsertResult }, 'Instruments persisted to Supabase');

    return { status: 'success', count: instruments.length };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error({ err: errorMsg }, 'BDFIN instruments runner failed');
    return { status: 'failed', count: 0, error: errorMsg };
  }
}
