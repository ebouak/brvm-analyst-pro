// scraper/src/headless/obscura.ts
import puppeteer from 'puppeteer';
import type { Browser, Page, ConnectOptions } from 'puppeteer';
import { logger } from '../logger.js';
import type { HeadlessBrowser, HeadlessPage, HeadlessConfig } from './types.js';
import { HeadlessError } from './types.js';

const log = logger.child({ module: 'headless:obscura' });

class ObscuraPage implements HeadlessPage {
  constructor(private page: Page) {}

  async goto(url: string, options?: { waitUntil?: 'networkidle0' | 'networkidle2' | 'domcontentloaded' }): Promise<void> {
    try {
      await this.page.goto(url, { waitUntil: options?.waitUntil ?? 'networkidle2', timeout: 30000 });
    } catch (err) {
      throw new HeadlessError(`Failed to navigate to ${url}`, err as Error);
    }
  }

  async content(): Promise<string> {
    try {
      return await this.page.content();
    } catch (err) {
      throw new HeadlessError('Failed to get page content', err as Error);
    }
  }

  async evaluate<T>(pageFunction: () => T): Promise<T> {
    try {
      return await this.page.evaluate(pageFunction);
    } catch (err) {
      throw new HeadlessError('Failed to evaluate function', err as Error);
    }
  }

  async $eval<T>(selector: string, pageFunction: (el: HTMLElement) => T): Promise<T> {
    try {
      return await this.page.$eval(selector, pageFunction as (el: Element) => T);
    } catch (err) {
      throw new HeadlessError(`Failed to $eval selector "${selector}"`, err as Error);
    }
  }

  async $$eval<T>(selector: string, pageFunction: (els: HTMLElement[]) => T): Promise<T> {
    try {
      return await this.page.$$eval(selector, pageFunction as (els: Element[]) => T);
    } catch (err) {
      throw new HeadlessError(`Failed to $$eval selector "${selector}"`, err as Error);
    }
  }

  async waitForSelector(selector: string, options?: { timeout?: number }): Promise<void> {
    try {
      await this.page.waitForSelector(selector, { timeout: options?.timeout ?? 10000 });
    } catch (err) {
      throw new HeadlessError(`Timeout waiting for selector "${selector}"`, err as Error);
    }
  }

  async click(selector: string): Promise<void> {
    try {
      await this.page.click(selector);
    } catch (err) {
      throw new HeadlessError(`Failed to click selector "${selector}"`, err as Error);
    }
  }

  async type(selector: string, text: string, options?: { delay?: number }): Promise<void> {
    try {
      await this.page.type(selector, text, { delay: options?.delay ?? 0 });
    } catch (err) {
      throw new HeadlessError(`Failed to type in selector "${selector}"`, err as Error);
    }
  }

  async cookies(): Promise<Array<{ name: string; value: string; domain?: string; path?: string; expires?: number; httpOnly?: boolean; secure?: boolean; sameSite?: string }>> {
    try {
      return await this.page.cookies();
    } catch (err) {
      throw new HeadlessError('Failed to get cookies', err as Error);
    }
  }

  async setCookie(cookie: { name: string; value: string; domain?: string; path?: string; expires?: number; httpOnly?: boolean; secure?: boolean; sameSite?: string }): Promise<void> {
    try {
      await this.page.setCookie(cookie as Parameters<typeof this.page.setCookie>[0]);
    } catch (err) {
      throw new HeadlessError(`Failed to set cookie "${cookie.name}"`, err as Error);
    }
  }

  async close(): Promise<void> {
    try {
      await this.page.close();
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : String(err) }, 'Error closing page');
    }
  }
}

export class ObscuraBrowser implements HeadlessBrowser {
  private browser: Browser | null = null;

  constructor(private config: HeadlessConfig) {}

  async connect(): Promise<void> {
    try {
      const connectOptions: ConnectOptions = {
        browserWSEndpoint: this.config.cdpUrl,
        defaultViewport: { width: 1920, height: 1080 },
      };
      this.browser = await puppeteer.connect(connectOptions);
      log.info({ cdpUrl: this.config.cdpUrl }, 'Connected to Obscura CDP');
    } catch (err) {
      throw new HeadlessError(`Failed to connect to Obscura at ${this.config.cdpUrl}`, err as Error);
    }
  }

  async newPage(): Promise<HeadlessPage> {
    if (!this.browser) {
      throw new HeadlessError('Browser not connected. Call connect() first.');
    }
    try {
      const page = await this.browser.newPage();
      if (this.config.stealth) {
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
          });
          Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
          });
        });
      }
      return new ObscuraPage(page);
    } catch (err) {
      throw new HeadlessError('Failed to create new page', err as Error);
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.disconnect();
        log.info('Disconnected from Obscura CDP');
      } catch (err) {
        log.warn({ err: err instanceof Error ? err.message : String(err) }, 'Error disconnecting from Obscura');
      }
    }
  }
}
