// scraper/src/scrapers/bdfin/market.ts
import { loginViaHeadless } from '../../client/bdfinAuthHeadless.js';
import { parseBdfinMarketActivities } from './parsers.js';
import type { HeadlessBrowser } from '../../headless/types.js';
import type { ScrapeBdfinMarketResult } from './types.js';
import { getConfig } from '../../config.js';
import { logger } from '../../logger.js';

const log = logger.child({ module: 'scrapers:bdfin:market' });

export async function scrapeBdfinMarket(
  browser: HeadlessBrowser,
  targetDate?: string,
): Promise<ScrapeBdfinMarketResult> {
  let page: any = null;
  const config = getConfig();

  try {
    // Authenticate
    log.info({ targetDate }, 'Authenticating to BDFIN for market data');
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

    log.info('Authentication successful, creating page for market data scrape');
    page = await browser.newPage();

    // Set cookies from auth
    for (const cookie of authResult.cookies) {
      await page.setCookie({
        name: cookie.name,
        value: cookie.value,
      });
    }

    // Navigate to market page
    const marketUrl = `${config.BDFIN_BASE_URL}${config.BDFIN_MARKET_PATH}`;
    log.info({ url: marketUrl, targetDate }, 'Navigating to market page');
    await page.goto(marketUrl, { waitUntil: 'networkidle2' });

    // If targetDate specified, interact with date picker to select that date
    if (targetDate) {
      log.debug({ targetDate }, 'Selecting target date via date picker');
      try {
        // Look for date input or date picker control
        const datePickerSelectors = [
          'input[id*="Date"], input[id*="date"]',
          'input[type="date"]',
          'input[class*="datepicker"]',
        ];

        let datePickerFound = false;
        for (const selector of datePickerSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 2000 });
            await page.click(selector);
            await page.type(selector, targetDate, { delay: 50 });
            await page.click('input[id*="Search"], input[id*="Filter"], button[id*="Go"]');
            datePickerFound = true;
            break;
          } catch {
            // Selector not found, try next
          }
        }

        if (datePickerFound) {
          await page.waitForSelector('body', { timeout: 10000 });
          log.debug({ targetDate }, 'Date selection completed');
        } else {
          log.warn({ targetDate }, 'Date picker not found, using default (most recent) date');
        }
      } catch (err) {
        log.warn(
          {
            targetDate,
            err: err instanceof Error ? err.message : String(err),
          },
          'Date selection failed, continuing with default date',
        );
      }
    }

    // Get page content
    const html = await page.content();
    log.debug({ htmlLength: html.length }, 'Page content retrieved');

    // Determine the date from the page or use provided date
    const dateMarche = targetDate || new Date().toISOString().slice(0, 10);
    log.info({ dateMarche }, 'Parsing market data');

    // Parse market data
    const marketData = parseBdfinMarketActivities(html, dateMarche);
    log.info(
      {
        actionsCount: marketData.actions.length,
        obligationsCount: marketData.obligations.length,
      },
      'Market data parsed',
    );

    if (marketData.actions.length === 0 && marketData.obligations.length === 0) {
      return {
        status: 'failed',
        error: 'No market data found in BDFIN response',
      };
    }

    return {
      status: 'success',
      data: marketData,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error({ err: errorMsg }, 'BDFIN market data scrape failed');
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
