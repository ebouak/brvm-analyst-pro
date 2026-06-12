// scraper/src/client/bdfinAuthHeadless.ts
import type { HeadlessBrowser, HeadlessPage } from '../headless/types.js';
import { HeadlessError } from '../headless/types.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'client:bdfinAuthHeadless' });

export interface HeadlessAuthResult {
  cookies: Array<{ name: string; value: string }>;
  finalUrl: string;
  success: boolean;
}

export class HeadlessAuthError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'HeadlessAuthError';
  }
}

const LOGIN_SELECTORS = {
  usernameField: 'input[id*="UserName"]',
  passwordField: 'input[id*="Password"]',
  submitButton: 'input[id*="LoginButton"], button[id*="LoginButton"]',
  loginForm: 'form[id*="aspnetForm"], form#aspnetForm',
  loginPageIndicator: 'input[id*="Login"]',
};

export async function loginViaHeadless(browser: HeadlessBrowser, baseUrl: string, loginPath: string, username: string, password: string, timeout: number = 30000): Promise<HeadlessAuthResult> {
  let page: HeadlessPage | null = null;

  try {
    page = await browser.newPage();

    const loginUrl = `${baseUrl}${loginPath}`;
    log.info({ url: loginUrl }, 'Navigating to login page');

    await page.goto(loginUrl, { waitUntil: 'networkidle2' });

    // Verify login page loaded
    try {
      await page.waitForSelector(LOGIN_SELECTORS.loginPageIndicator, { timeout: 5000 });
    } catch {
      const content = await page.content();
      if (!content.includes('login') && !content.includes('Login')) {
        throw new HeadlessAuthError('Login page did not load — may already be authenticated or page structure changed');
      }
    }

    // Fill credentials
    log.debug('Filling username field');
    await page.click(LOGIN_SELECTORS.usernameField);
    await page.type(LOGIN_SELECTORS.usernameField, username, { delay: 50 });

    log.debug('Filling password field');
    await page.click(LOGIN_SELECTORS.passwordField);
    await page.type(LOGIN_SELECTORS.passwordField, password, { delay: 50 });

    // Submit
    log.debug('Clicking submit button');
    await page.click(LOGIN_SELECTORS.submitButton);

    // Wait for redirect or dashboard indicators
    try {
      await page.waitForSelector('body', { timeout }); // Wait for page load
      const finalUrl = await page.evaluate(() => window.location.href);
      log.info({ finalUrl }, 'Login complete, redirected');

      // Harvest cookies
      const cookies = await page.cookies();
      const result: HeadlessAuthResult = {
        cookies: cookies.map((c) => ({ name: c.name, value: c.value })),
        finalUrl,
        success: !finalUrl.includes('login') && !finalUrl.includes('Login'),
      };

      if (!result.success) {
        log.warn({ finalUrl }, 'Login redirect suggests authentication failed');
      }

      return result;
    } catch (err) {
      throw new HeadlessAuthError('Timeout during login — page did not respond', err as Error);
    }
  } catch (err) {
    if (err instanceof HeadlessError || err instanceof HeadlessAuthError) {
      throw err;
    }
    throw new HeadlessAuthError(`Headless login failed: ${err instanceof Error ? err.message : String(err)}`, err as Error);
  } finally {
    if (page) {
      await page.close();
    }
  }
}
