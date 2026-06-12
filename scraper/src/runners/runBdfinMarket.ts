// scraper/src/runners/runBdfinMarket.ts
import { scrapeBdfinMarket } from '../scrapers/bdfin/market.js';
import { upsertActions, upsertObligations } from '../persistence/repository.js';
import type { HeadlessBrowser } from '../headless/types.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'runners:bdfin:market' });

export interface RunBdfinMarketResult {
  status: 'success' | 'partial' | 'failed';
  actions: number;
  obligations: number;
  error?: string;
}

export async function runBdfinMarket(browser: HeadlessBrowser, targetDate?: string): Promise<RunBdfinMarketResult> {
  try {
    log.info({ targetDate }, 'Starting BDFIN market data scrape and persist');

    // Scrape
    const scrapeResult = await scrapeBdfinMarket(browser, targetDate);
    if (scrapeResult.status === 'failed') {
      log.error({ error: scrapeResult.error }, 'BDFIN market scrape failed');
      return { status: 'failed', actions: 0, obligations: 0, error: scrapeResult.error };
    }

    const marketData = scrapeResult.data!;
    log.info(
      { date: marketData.date_marche, actions: marketData.actions.length, obligations: marketData.obligations.length },
      'Market data scraped successfully',
    );

    // Persist actions
    const actionsResult = await upsertActions(marketData.actions.map((a) => ({ ...a, date_marche: marketData.date_marche })));
    log.info({ upserted: actionsResult }, 'Actions persisted');

    // Persist obligations
    const obligationsResult = await upsertObligations(
      marketData.obligations.map((o) => ({ ...o, date_marche: marketData.date_marche })),
    );
    log.info({ upserted: obligationsResult }, 'Obligations persisted');

    return {
      status: 'success',
      actions: marketData.actions.length,
      obligations: marketData.obligations.length,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error({ err: errorMsg }, 'BDFIN market runner failed');
    return { status: 'failed', actions: 0, obligations: 0, error: errorMsg };
  }
}
