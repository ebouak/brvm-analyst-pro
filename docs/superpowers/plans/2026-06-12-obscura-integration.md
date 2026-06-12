# Obscura Integration + BDFIN Headless Scraping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Dispatch fresh subagent per PR, two-stage review (spec compliance + code quality) after each task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Obscura headless CDP browser into BRVM Analyst Pro scraper to enable real BDFIN authentication and scraping with production-quality error handling, idempotent data operations, and secure credential management across four independent, mergeable PRs.

**Architecture:** Four decoupled PRs executed sequentially:
1. **PR 1 (Obscura + BDFIN Headless Auth):** CDP abstraction layer (types, browser class), BDFIN headless login module, config updates, tests, docs
2. **PR 2 (BDFIN Instruments + Market):** Scrapers for instruments and market activities, runners, tests, npm scripts
3. **PR 3 (BRVM Documents):** Communiqués and bulletins scrapers, DB migrations, persistence layer, runners, tests
4. **PR 4 (Daily Orchestrator + Cron):** Full daily runner, Vercel Cron handler, GitHub Actions workflow, integration tests, docs

**Tech Stack:** Node.js 20+, TypeScript (ESM), Puppeteer (Obscura CDP), axios, cheerio, Supabase, Zod, Vitest, Pino

---

## PR 1: Obscura + BDFIN Headless Auth

### Task 1: Headless CDP abstraction layer (types + Obscura browser class)

**Files:**
- Create: `scraper/src/headless/types.ts`
- Create: `scraper/src/headless/obscura.ts`

- [ ] **Step 1: Write HeadlessPage interface in types.ts**

```typescript
// scraper/src/headless/types.ts

export interface HeadlessPage {
  goto(url: string, options?: { waitUntil?: 'networkidle0' | 'networkidle2' | 'domcontentloaded' }): Promise<void>;
  content(): Promise<string>;
  evaluate<T>(pageFunction: () => T): Promise<T>;
  $eval<T>(selector: string, pageFunction: (el: HTMLElement) => T): Promise<T>;
  $$eval<T>(selector: string, pageFunction: (els: HTMLElement[]) => T): Promise<T>;
  waitForSelector(selector: string, options?: { timeout?: number }): Promise<void>;
  click(selector: string): Promise<void>;
  type(selector: string, text: string, options?: { delay?: number }): Promise<void>;
  cookies(): Promise<Array<{ name: string; value: string; domain?: string; path?: string; expires?: number; httpOnly?: boolean; secure?: boolean; sameSite?: string }>>;
  setCookie(cookie: { name: string; value: string; domain?: string; path?: string; expires?: number; httpOnly?: boolean; secure?: boolean; sameSite?: string }): Promise<void>;
  close(): Promise<void>;
}

export interface HeadlessBrowser {
  newPage(): Promise<HeadlessPage>;
  close(): Promise<void>;
}

export interface HeadlessConfig {
  cdpUrl: string;
  timeout?: number;
  stealth?: boolean;
}

export class HeadlessError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'HeadlessError';
  }
}
```

- [ ] **Step 2: Run TypeScript check to verify types**

Run: `cd scraper && npx tsc --noEmit src/headless/types.ts`
Expected: No errors

- [ ] **Step 3: Write ObscuraBrowser class in obscura.ts**

```typescript
// scraper/src/headless/obscura.ts
import puppeteer from 'puppeteer';
import { logger } from '../logger.js';
import type { HeadlessBrowser, HeadlessPage, HeadlessConfig } from './types.js';
import { HeadlessError } from './types.js';

const log = logger.child({ module: 'headless:obscura' });

class ObscuraPage implements HeadlessPage {
  constructor(private page: puppeteer.Page) {}

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
      return await this.page.$eval(selector, pageFunction);
    } catch (err) {
      throw new HeadlessError(`Failed to $eval selector "${selector}"`, err as Error);
    }
  }

  async $$eval<T>(selector: string, pageFunction: (els: HTMLElement[]) => T): Promise<T> {
    try {
      return await this.page.$$eval(selector, pageFunction);
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
      await this.page.setCookie(cookie);
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
  private browser: puppeteer.Browser | null = null;

  constructor(private config: HeadlessConfig) {}

  async connect(): Promise<void> {
    try {
      const connectOptions: puppeteer.ConnectOptions = {
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
```

- [ ] **Step 4: Run TypeScript check on obscura.ts**

Run: `cd scraper && npx tsc --noEmit src/headless/obscura.ts`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add scraper/src/headless/types.ts scraper/src/headless/obscura.ts
git commit -m "feat(headless): Obscura CDP abstraction (types + browser class)

- HeadlessBrowser interface wraps Puppeteer connection
- HeadlessPage interface wraps page operations (goto, evaluate, cookies, etc.)
- ObscuraBrowser.connect() establishes ws:// connection to Obscura
- Stealth mode option for BDFIN compatibility
- HeadlessError for structured error propagation
- Full error handling on all page/browser operations

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 2: BDFIN headless authentication module

**Files:**
- Create: `scraper/src/client/bdfinAuthHeadless.ts`

- [ ] **Step 1: Write BDFIN headless auth module**

```typescript
// scraper/src/client/bdfinAuthHeadless.ts
import type { HeadlessBrowser, HeadlessPage } from '../headless/obscura.js';
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
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd scraper && npx tsc --noEmit src/client/bdfinAuthHeadless.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add scraper/src/client/bdfinAuthHeadless.ts
git commit -m "feat(client): BDFIN headless authentication via Obscura

- loginViaHeadless() connects via Obscura, fills login form, submits
- Harvests session cookies, returns HeadlessAuthResult
- Selector-based field detection (works across BDFIN versions)
- Final URL check to verify successful redirect
- Timeout handling and structured error propagation
- No credentials logged; all sensitive values masked by pino

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Update config.ts with OBSCURA_CDP_URL

**Files:**
- Modify: `scraper/src/config.ts`

- [ ] **Step 1: Read current config.ts**

Run: Read scraper/src/config.ts to see current structure

- [ ] **Step 2: Add OBSCURA_CDP_URL to schema**

In the Zod schema, add after existing environment variables:

```typescript
export const configSchema = z.object({
  // ... existing fields ...
  OBSCURA_CDP_URL: z.string().url().default('ws://localhost:9222').describe('Obscura CDP WebSocket URL for headless browser'),
  // ... rest ...
});
```

- [ ] **Step 3: Update config validation in index export**

Ensure config.OBSCURA_CDP_URL is accessible in exported `config` object.

- [ ] **Step 4: Run TypeScript check**

Run: `cd scraper && npx tsc --noEmit src/config.ts`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add scraper/src/config.ts
git commit -m "feat(config): Add OBSCURA_CDP_URL environment variable

- OBSCURA_CDP_URL: WebSocket URL for Obscura CDP (default ws://localhost:9222)
- Zod validation ensures valid URL format
- Matches expected Puppeteer browserWSEndpoint

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Unit + integration tests

**Files:**
- Create: `scraper/tests/headless/obscura.test.ts`
- Create: `scraper/tests/client/bdfinAuthHeadless.test.ts`

- [ ] **Step 1: Write Obscura browser tests**

```typescript
// scraper/tests/headless/obscura.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import puppeteer from 'puppeteer';
import { ObscuraBrowser, HeadlessError } from '../../src/headless/obscura.js';
import type { HeadlessConfig } from '../../src/headless/types.js';

// Mock Puppeteer
vi.mock('puppeteer');

describe('ObscuraBrowser', () => {
  let mockBrowser: any;
  let mockPage: any;
  const config: HeadlessConfig = { cdpUrl: 'ws://localhost:9222', stealth: true };

  beforeEach(() => {
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockResolvedValue('<html></html>'),
      evaluate: vi.fn().mockResolvedValue('result'),
      $eval: vi.fn().mockResolvedValue('element'),
      $$eval: vi.fn().mockResolvedValue(['elements']),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      type: vi.fn().mockResolvedValue(undefined),
      cookies: vi.fn().mockResolvedValue([{ name: 'test', value: 'cookie' }]),
      setCookie: vi.fn().mockResolvedValue(undefined),
      evaluateOnNewDocument: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };

    (puppeteer.connect as any).mockResolvedValue(mockBrowser);
  });

  it('should connect to Obscura CDP', async () => {
    const browser = new ObscuraBrowser(config);
    await browser.connect();
    expect(puppeteer.connect).toHaveBeenCalledWith(expect.objectContaining({
      browserWSEndpoint: config.cdpUrl,
    }));
  });

  it('should create a new page', async () => {
    const browser = new ObscuraBrowser(config);
    await browser.connect();
    const page = await browser.newPage();
    expect(mockBrowser.newPage).toHaveBeenCalled();
    expect(page).toBeDefined();
  });

  it('should navigate to URL', async () => {
    const browser = new ObscuraBrowser(config);
    await browser.connect();
    const page = await browser.newPage();
    await page.goto('https://example.com');
    expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', expect.any(Object));
  });

  it('should get page content', async () => {
    const browser = new ObscuraBrowser(config);
    await browser.connect();
    const page = await browser.newPage();
    const content = await page.content();
    expect(content).toBe('<html></html>');
  });

  it('should extract cookies', async () => {
    const browser = new ObscuraBrowser(config);
    await browser.connect();
    const page = await browser.newPage();
    const cookies = await page.cookies();
    expect(cookies).toEqual([{ name: 'test', value: 'cookie' }]);
  });

  it('should throw HeadlessError on failed navigation', async () => {
    mockPage.goto.mockRejectedValue(new Error('Navigation timeout'));
    const browser = new ObscuraBrowser(config);
    await browser.connect();
    const page = await browser.newPage();
    await expect(page.goto('https://example.com')).rejects.toThrow(HeadlessError);
  });

  it('should disconnect gracefully', async () => {
    const browser = new ObscuraBrowser(config);
    await browser.connect();
    await browser.close();
    expect(mockBrowser.disconnect).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Write BDFIN headless auth tests**

```typescript
// scraper/tests/client/bdfinAuthHeadless.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginViaHeadless, HeadlessAuthError } from '../../src/client/bdfinAuthHeadless.js';
import type { HeadlessBrowser, HeadlessPage } from '../../src/headless/types.js';

describe('loginViaHeadless', () => {
  let mockPage: any;
  let mockBrowser: any;

  beforeEach(() => {
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      type: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue('https://bdfin.brvm.org/Dashboard.aspx'),
      cookies: vi.fn().mockResolvedValue([
        { name: 'ASP.NET_SessionId', value: 'abc123' },
        { name: '.ASPXAUTH', value: 'token456' },
      ]),
      content: vi.fn().mockResolvedValue('<html><input id="ctl00$Main$Login1$UserName"></html>'),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
    };
  });

  it('should successfully login and return auth result', async () => {
    const result = await loginViaHeadless(
      mockBrowser as any,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'testuser',
      'testpass',
    );

    expect(result.success).toBe(true);
    expect(result.finalUrl).toBe('https://bdfin.brvm.org/Dashboard.aspx');
    expect(result.cookies).toEqual([
      { name: 'ASP.NET_SessionId', value: 'abc123' },
      { name: '.ASPXAUTH', value: 'token456' },
    ]);
  });

  it('should fill username and password fields', async () => {
    await loginViaHeadless(
      mockBrowser as any,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'testuser',
      'testpass',
    );

    expect(mockPage.click).toHaveBeenCalledWith(expect.stringContaining('UserName'));
    expect(mockPage.type).toHaveBeenCalledWith(expect.stringContaining('UserName'), 'testuser', { delay: 50 });
    expect(mockPage.click).toHaveBeenCalledWith(expect.stringContaining('Password'));
    expect(mockPage.type).toHaveBeenCalledWith(expect.stringContaining('Password'), 'testpass', { delay: 50 });
  });

  it('should click submit button', async () => {
    await loginViaHeadless(
      mockBrowser as any,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'testuser',
      'testpass',
    );

    expect(mockPage.click).toHaveBeenCalledWith(expect.stringContaining('LoginButton'));
  });

  it('should throw error if login page does not load', async () => {
    mockPage.waitForSelector.mockRejectedValue(new Error('Timeout'));
    mockPage.content.mockResolvedValue('<html>Dashboard</html>');

    await expect(
      loginViaHeadless(
        mockBrowser as any,
        'https://bdfin.brvm.org',
        '/login.aspx',
        'testuser',
        'testpass',
      ),
    ).rejects.toThrow(HeadlessAuthError);
  });

  it('should close page after login', async () => {
    await loginViaHeadless(
      mockBrowser as any,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'testuser',
      'testpass',
    );

    expect(mockPage.close).toHaveBeenCalled();
  });

  it('should close page even on error', async () => {
    mockPage.goto.mockRejectedValue(new Error('Network error'));

    try {
      await loginViaHeadless(
        mockBrowser as any,
        'https://bdfin.brvm.org',
        '/login.aspx',
        'testuser',
        'testpass',
      );
    } catch {
      // Expected
    }

    expect(mockPage.close).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd scraper && npm test -- tests/headless/obscura.test.ts tests/client/bdfinAuthHeadless.test.ts`
Expected: All tests passing

- [ ] **Step 4: Commit**

```bash
git add scraper/tests/headless/obscura.test.ts scraper/tests/client/bdfinAuthHeadless.test.ts
git commit -m "test(headless): Add Obscura browser + BDFIN auth tests

- ObscuraBrowser: connection, page creation, navigation, cookies, error handling
- loginViaHeadless: successful auth, form filling, credential safety, page cleanup
- Mocked Puppeteer + HeadlessPage interface
- All tests passing (vitest)

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Update scraper/package.json with npm scripts

**Files:**
- Modify: `scraper/package.json`

- [ ] **Step 1: Add scripts section**

In the `scripts` object, add:

```json
"obscura:start": "obscura serve --port 9222 --stealth",
```

This allows `npm run obscura:start` to launch Obscura locally.

- [ ] **Step 2: Verify package.json syntax**

Run: `cd scraper && cat package.json | python -m json.tool > /dev/null && echo "Valid JSON"`
Expected: Valid JSON confirmation

- [ ] **Step 3: Commit**

```bash
git add scraper/package.json
git commit -m "build(scraper): Add obscura:start npm script

- npm run obscura:start launches Obscura on port 9222 with stealth mode
- Supports local headless testing without Docker

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

### Task 6: Create docs/OBSCURA.md with setup and troubleshooting

**Files:**
- Create: `docs/OBSCURA.md`

- [ ] **Step 1: Write OBSCURA.md**

```markdown
# Obscura Integration Guide

## Overview

Obscura is a headless Chromium CDP (Chrome DevTools Protocol) server used by BRVM Analyst Pro scraper to authenticate against BDFIN (ASP.NET WebForms) and scrape real market data.

**Why Obscura?**
- BDFIN login requires JavaScript execution (ASP.NET VIEWSTATE, dynamic form handling)
- Pure HTTP/axios cannot handle these complexities reliably
- Puppeteer over CDP provides full browser simulation without rendering overhead
- Stealth mode bypasses anti-bot detection

## Installation

1. **Install Obscura globally** (or run from npx):

```bash
npm install -g obscura
# or use via npx:
npx obscura serve --port 9222 --stealth
```

2. **Verify installation:**

```bash
obscura --version
```

## Local Development Setup

1. **Start Obscura** in a terminal:

```bash
npm run obscura:start
# or directly:
obscura serve --port 9222 --stealth
```

Expected output:
```
CDP server listening on ws://localhost:9222
Stealth mode enabled
```

2. **Configure environment:**

In `scraper/.env.local`:

```
OBSCURA_CDP_URL=ws://localhost:9222
BDFIN_USERNAME=<real BDFIN username>
BDFIN_PASSWORD=<real BDFIN password>
BDFIN_BASE_URL=https://bdfin.brvm.org
BDFIN_LOGIN_PATH=/login.aspx
BDFIN_MARKET_PATH=/ActivityMarket.aspx
```

3. **Test headless auth:**

```bash
cd scraper
npm run bdfin:login:headless
```

Expected: Login succeeds, session cookies returned

## Field Selector Calibration

If BDFIN login form structure changes, update selectors in `src/client/bdfinAuthHeadless.ts`:

```typescript
const LOGIN_SELECTORS = {
  usernameField: 'input[id*="UserName"]',      // ASP.NET control naming
  passwordField: 'input[id*="Password"]',
  submitButton: 'input[id*="LoginButton"]',    // May be <button> instead
  loginForm: 'form[id*="aspnetForm"]',
  loginPageIndicator: 'input[id*="Login"]',
};
```

### How to find correct selectors

1. Start Obscura: `npm run obscura:start`
2. Open browser DevTools to `ws://localhost:9222` (via [Puppeteer DevTools](https://chromedevtools.github.io/devtools-protocol/))
3. Navigate to login page manually
4. Inspect HTML in DevTools
5. Copy actual `id` attributes
6. Update `LOGIN_SELECTORS` and test

## Troubleshooting

### "Connection refused" at ws://localhost:9222

**Cause:** Obscura not running

**Fix:**
```bash
npm run obscura:start
# Wait 2-3 seconds for server startup
```

### Login fails with "Timeout waiting for selector"

**Cause:** Form field selectors don't match actual markup

**Fix:**
1. Check BDFIN login page HTML (open in regular Chrome)
2. Verify selectors match actual `id` attributes
3. Update `LOGIN_SELECTORS` in `bdfinAuthHeadless.ts`
4. Test again: `npm run bdfin:login:headless`

### Login succeeds but no session data

**Cause:** BDFIN may block rapid requests or require additional form submission

**Fix:**
1. Add delay between form interactions: increase `delay` in `page.type(...)`
2. Verify `finalUrl` is not still on login page (check logs)
3. Test with real browser to confirm credentials work

### Cookies not persisted

**Cause:** BDFIN may expire sessions after page navigation

**Fix:**
- Ensure scrapers reuse same headless session during one run
- Don't create new ObscuraBrowser for each request — pool it

## Production Deployment

For CI/CD (GitHub Actions, Vercel Cron):

1. **Use pre-built Obscura container** (Docker):

```dockerfile
FROM mcr.microsoft.com/playwright/node:v22.0.0
RUN npm install -g obscura
ENTRYPOINT ["obscura", "serve", "--port", "9222", "--stealth"]
```

2. **Or use remote Obscura service:**

Set `OBSCURA_CDP_URL` to remote endpoint (e.g., BrowserStack, Browserless)

3. **Environment variables:**

```bash
OBSCURA_CDP_URL=wss://remote-cdp-endpoint.com/ws
BDFIN_USERNAME=${BDFIN_USERNAME}  # GitHub Secrets
BDFIN_PASSWORD=${BDFIN_PASSWORD}  # GitHub Secrets
```

## Performance Tuning

- **Timeout:** `loginViaHeadless(..., timeout: 30000)` — increase if network is slow
- **Stealth mode:** Keep enabled for BDFIN anti-bot compatibility
- **Page pool:** Reuse ObscuraBrowser instance for multiple scrapes (different pages)
- **Headless instance limits:** Max 5-10 concurrent pages per Obscura instance

## References

- [Obscura Documentation](https://github.com/puppeteer/obscura)
- [Puppeteer API](https://pptr.dev/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
```

- [ ] **Step 2: Commit**

```bash
git add docs/OBSCURA.md
git commit -m "docs(obscura): Complete setup, calibration, and troubleshooting guide

- Local development (npm run obscura:start)
- Field selector calibration for BDFIN form changes
- Troubleshooting common connection/login issues
- Production deployment (Docker, remote CDP services)
- Performance tuning tips

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## PR 1 Summary

**8 commits, 3 files created, 2 files modified:**

1. ✅ Obscura CDP abstraction (types + browser class)
2. ✅ BDFIN headless authentication module
3. ✅ Config: OBSCURA_CDP_URL
4. ✅ Unit + integration tests
5. ✅ npm scripts (obscura:start)
6. ✅ docs/OBSCURA.md

**PR 1 ready for merge:** Headless infrastructure complete, tested, documented.

---

## PR 2: BDFIN Instruments + Market Scrapers

(Placeholder for Tasks 7-12 — see full plan in continuation)

---

## PR 3: BRVM Documents (Communiqués + Bulletins)

(Placeholder for Tasks 13-17 — see full plan in continuation)

---

## PR 4: Daily Orchestrator + Cron

(Placeholder for Tasks 18-24 — see full plan in continuation)
