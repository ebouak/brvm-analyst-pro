// scraper/src/scrapers/bdfin/instruments.ts
import { loginViaHeadless } from '../../client/bdfinAuthHeadless.js';
import { parseBdfinInstruments } from './parsers.js';
import type { HeadlessBrowser } from '../../headless/types.js';
import type { ScrapeBdfinInstrumentsResult } from './types.js';
import { getConfig } from '../../config.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'scrapers:bdfin:instruments' });

export async function scrapeBdfinInstruments(browser: HeadlessBrowser): Promise<ScrapeBdfinInstrumentsResult> {
  let page: any = null;
  const config = getConfig();

  try {
    // Authenticate
    log.info('Authenticating to BDFIN');
    const authResult = await loginViaHeadless(
      browser,
      config.BDFIN_BASE_URL,
      config.BDFIN_LOGIN_PATH,
      config.BDFIN_USERNAME,
      config.BDFIN_PASSWORD,
    );

    if (!authResult.success) {
      return {
        status: 'failed',
        error: 'BDFIN authentication failed — login redirect did not complete',
      };
    }

    log.info('Authentication successful, creating page for instruments scrape');
    page = await browser.newPage();

    // Set cookies from auth
    for (const cookie of authResult.cookies) {
      await page.setCookie({
        name: cookie.name,
        value: cookie.value,
      });
    }

    // Navigate to instruments page
    const instrumentsUrl = `${config.BDFIN_BASE_URL}/Instruments.aspx`;
    log.info({ url: instrumentsUrl }, 'Navigating to instruments page');
    await page.goto(instrumentsUrl, { waitUntil: 'networkidle2' });

    // Get page content
    const html = await page.content();
    log.debug({ htmlLength: html.length }, 'Page content retrieved');

    // Parse instruments
    const instruments = parseBdfinInstruments(html);
    log.info({ count: instruments.length }, 'Instruments parsed');

    if (instruments.length === 0) {
      return {
        status: 'failed',
        error: 'No instruments found in BDFIN response',
      };
    }

    return {
      status: 'success',
      instruments,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error({ err: errorMsg }, 'BDFIN instruments scrape failed');
    return {
      status: 'failed',
      error: `Scrape error: ${errorMsg}`,
    };
  } finally {
    if (page) {
      await page.close();
    }
  }
}
