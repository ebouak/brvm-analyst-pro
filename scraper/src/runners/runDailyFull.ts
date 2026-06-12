// scraper/src/runners/runDailyFull.ts
import { ObscuraBrowser } from '../headless/obscura.js';
import { runBdfinInstruments } from './runBdfinInstruments.js';
import { runBdfinMarket } from './runBdfinMarket.js';
import { runCommuniques } from './runCommuniques.js';
import { runBulletins } from './runBulletins.js';
import { runNews } from '../scrapers/runNews.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'runners:daily:full' });

export interface DailyRunResult {
  startedAt: string;
  finishedAt: string;
  status: 'success' | 'partial' | 'failed';
  results: {
    bdfinInstruments?: { status: string; count: number };
    bdfinMarket?: { status: string; actions: number; obligations: number };
    communiques?: { status: string; count: number };
    bulletins?: { status: string; count: number };
    news?: { status: string; count?: number };
  };
  errors: Array<{ step: string; error: string }>;
  summary: {
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
  };
}

export async function runDailyFull(targetDate?: string): Promise<DailyRunResult> {
  const startedAt = new Date().toISOString();
  const results: DailyRunResult['results'] = {};
  const errors: Array<{ step: string; error: string }> = [];
  let successCount = 0;
  const totalSteps = 5;

  try {
    log.info({ targetDate }, 'Starting daily full scrape');

    // Initialize Obscura browser
    let browser: ObscuraBrowser | null = null;
    try {
      const cfg = getConfig();
      browser = new ObscuraBrowser({ cdpUrl: cfg.OBSCURA_CDP_URL, stealth: true });
      await browser.connect();
      log.info('Obscura browser connected');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error({ err: errorMsg }, 'Failed to connect Obscura browser');
      errors.push({ step: 'obscura_connect', error: errorMsg });
      // Continue without BDFIN scrapers
    }

    // 1. BDFIN Instruments
    if (browser) {
      try {
        log.info('Starting BDFIN instruments scrape');
        const result = await runBdfinInstruments(browser);
        results.bdfinInstruments = { status: result.status, count: result.count };
        if (result.status === 'success') successCount++;
        log.info({ result }, 'BDFIN instruments completed');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push({ step: 'bdfin_instruments', error: errorMsg });
        log.error({ err: errorMsg }, 'BDFIN instruments failed');
      }
    }

    // 2. BDFIN Market
    if (browser) {
      try {
        log.info('Starting BDFIN market data scrape');
        const result = await runBdfinMarket(browser, targetDate);
        results.bdfinMarket = { status: result.status, actions: result.actions, obligations: result.obligations };
        if (result.status === 'success') successCount++;
        log.info({ result }, 'BDFIN market completed');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push({ step: 'bdfin_market', error: errorMsg });
        log.error({ err: errorMsg }, 'BDFIN market failed');
      }
    }

    // 3. Communiqués
    try {
      log.info('Starting communiqués scrape');
      const result = await runCommuniques();
      results.communiques = { status: result.status, count: result.count };
      if (result.status === 'success') successCount++;
      log.info({ result }, 'Communiqués completed');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push({ step: 'communiques', error: errorMsg });
      log.error({ err: errorMsg }, 'Communiqués failed');
    }

    // 4. Bulletins
    try {
      log.info('Starting bulletins scrape');
      const result = await runBulletins();
      results.bulletins = { status: result.status, count: result.count };
      if (result.status === 'success') successCount++;
      log.info({ result }, 'Bulletins completed');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push({ step: 'bulletins', error: errorMsg });
      log.error({ err: errorMsg }, 'Bulletins failed');
    }

    // 5. News (HTTP only, no Obscura needed)
    try {
      log.info('Starting news scrape');
      await runNews();
      results.news = { status: 'success' };
      successCount++;
      log.info('News completed');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push({ step: 'news', error: errorMsg });
      log.error({ err: errorMsg }, 'News failed');
    }

    // Cleanup
    if (browser) {
      try {
        await browser.close();
        log.info('Obscura browser disconnected');
      } catch (err) {
        log.warn('Error closing Obscura browser');
      }
    }

    // Determine final status
    const failedSteps = totalSteps - successCount;
    const status: 'success' | 'partial' | 'failed' =
      failedSteps === 0 ? 'success' : failedSteps === totalSteps ? 'failed' : 'partial';

    const finishedAt = new Date().toISOString();
    const result: DailyRunResult = {
      startedAt,
      finishedAt,
      status,
      results,
      errors,
      summary: {
        totalSteps,
        successfulSteps: successCount,
        failedSteps,
      },
    };

    log.info({ result }, 'Daily full scrape completed');
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error({ err: errorMsg }, 'Daily full scrape failed with exception');
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      status: 'failed',
      results,
      errors: [...errors, { step: 'orchestrator', error: errorMsg }],
      summary: {
        totalSteps,
        successfulSteps: successCount,
        failedSteps: totalSteps - successCount,
      },
    };
  }
}
