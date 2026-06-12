// scraper/tests/headless/obscura.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import puppeteer from 'puppeteer';
import { ObscuraBrowser } from '../../src/headless/obscura.js';
import { HeadlessError } from '../../src/headless/types.js';

vi.mock('puppeteer');

describe('ObscuraBrowser', () => {
  let mockBrowser: any;
  let mockPage: any;
  const config = { cdpUrl: 'ws://localhost:9222', stealth: true };

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
      browserWSEndpoint: 'ws://localhost:9222',
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

  it('should throw HeadlessError if browser not connected', async () => {
    const browser = new ObscuraBrowser(config);
    await expect(browser.newPage()).rejects.toThrow(HeadlessError);
  });

  it('should disconnect gracefully', async () => {
    const browser = new ObscuraBrowser(config);
    await browser.connect();
    await browser.close();
    expect(mockBrowser.disconnect).toHaveBeenCalled();
  });

  describe('ObscuraPage methods', () => {
    let browser: ObscuraBrowser;

    beforeEach(async () => {
      browser = new ObscuraBrowser(config);
      await browser.connect();
    });

    it('should evaluate functions in page context', async () => {
      const page = await browser.newPage();
      mockPage.evaluate.mockResolvedValue(42);
      const result = await page.evaluate(() => 42);
      expect(result).toBe(42);
    });

    it('should handle $eval for single element', async () => {
      const page = await browser.newPage();
      mockPage.$eval.mockResolvedValue('found');
      const result = await page.$eval('button', () => 'found');
      expect(result).toBe('found');
    });

    it('should handle $$eval for multiple elements', async () => {
      const page = await browser.newPage();
      mockPage.$$eval.mockResolvedValue(['a', 'b', 'c']);
      const result = await page.$$eval('div', () => ['a', 'b', 'c']);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should wait for selector to appear', async () => {
      const page = await browser.newPage();
      await page.waitForSelector('.modal');
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.modal', { timeout: 10000 });
    });

    it('should click on selector', async () => {
      const page = await browser.newPage();
      await page.click('button');
      expect(mockPage.click).toHaveBeenCalledWith('button');
    });

    it('should type text into selector', async () => {
      const page = await browser.newPage();
      await page.type('input', 'test text', { delay: 50 });
      expect(mockPage.type).toHaveBeenCalledWith('input', 'test text', { delay: 50 });
    });

    it('should set cookies', async () => {
      const page = await browser.newPage();
      const cookie = { name: 'session', value: 'abc123' };
      await page.setCookie(cookie);
      expect(mockPage.setCookie).toHaveBeenCalledWith(cookie);
    });

    it('should close page', async () => {
      const page = await browser.newPage();
      await page.close();
      expect(mockPage.close).toHaveBeenCalled();
    });

    it('should throw HeadlessError on $eval failure', async () => {
      mockPage.$eval.mockRejectedValue(new Error('Element not found'));
      const page = await browser.newPage();
      await expect(page.$eval('button', () => {})).rejects.toThrow(HeadlessError);
    });

    it('should throw HeadlessError on $$eval failure', async () => {
      mockPage.$$eval.mockRejectedValue(new Error('Elements not found'));
      const page = await browser.newPage();
      await expect(page.$$eval('div', () => [])).rejects.toThrow(HeadlessError);
    });

    it('should throw HeadlessError on waitForSelector timeout', async () => {
      mockPage.waitForSelector.mockRejectedValue(new Error('Timeout'));
      const page = await browser.newPage();
      await expect(page.waitForSelector('.modal')).rejects.toThrow(HeadlessError);
    });

    it('should throw HeadlessError on click failure', async () => {
      mockPage.click.mockRejectedValue(new Error('Element not clickable'));
      const page = await browser.newPage();
      await expect(page.click('button')).rejects.toThrow(HeadlessError);
    });

    it('should throw HeadlessError on type failure', async () => {
      mockPage.type.mockRejectedValue(new Error('Focus failed'));
      const page = await browser.newPage();
      await expect(page.type('input', 'text')).rejects.toThrow(HeadlessError);
    });

    it('should throw HeadlessError on content failure', async () => {
      mockPage.content.mockRejectedValue(new Error('Content unavailable'));
      const page = await browser.newPage();
      await expect(page.content()).rejects.toThrow(HeadlessError);
    });

    it('should throw HeadlessError on evaluate failure', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Script error'));
      const page = await browser.newPage();
      await expect(page.evaluate(() => {})).rejects.toThrow(HeadlessError);
    });

    it('should throw HeadlessError on setCookie failure', async () => {
      mockPage.setCookie.mockRejectedValue(new Error('Cookie invalid'));
      const page = await browser.newPage();
      await expect(page.setCookie({ name: 'test', value: 'val' })).rejects.toThrow(HeadlessError);
    });

    it('should throw HeadlessError on cookies failure', async () => {
      mockPage.cookies.mockRejectedValue(new Error('Cookies unavailable'));
      const page = await browser.newPage();
      await expect(page.cookies()).rejects.toThrow(HeadlessError);
    });
  });

  describe('Browser connection errors', () => {
    it('should throw HeadlessError on connection failure', async () => {
      (puppeteer.connect as any).mockRejectedValue(new Error('CDP unreachable'));
      const browser = new ObscuraBrowser(config);
      await expect(browser.connect()).rejects.toThrow(HeadlessError);
    });

    it('should throw HeadlessError if newPage called before connect', async () => {
      const browser = new ObscuraBrowser(config);
      await expect(browser.newPage()).rejects.toThrow('Browser not connected');
    });

    it('should throw HeadlessError on page creation failure', async () => {
      mockBrowser.newPage.mockRejectedValue(new Error('Cannot create page'));
      const browser = new ObscuraBrowser(config);
      await browser.connect();
      await expect(browser.newPage()).rejects.toThrow(HeadlessError);
    });
  });

  describe('Stealth mode', () => {
    it('should apply stealth evaluations when stealth is enabled', async () => {
      const stealthConfig = { cdpUrl: 'ws://localhost:9222', stealth: true };
      const browser = new ObscuraBrowser(stealthConfig);
      await browser.connect();
      const page = await browser.newPage();

      // Verify that evaluateOnNewDocument was called
      expect(mockPage.evaluateOnNewDocument).toHaveBeenCalled();
      expect(page).toBeDefined();
    });

    it('should skip stealth evaluations when stealth is disabled', async () => {
      mockPage.evaluateOnNewDocument.mockClear();
      const noStealthConfig = { cdpUrl: 'ws://localhost:9222', stealth: false };
      const browser = new ObscuraBrowser(noStealthConfig);
      await browser.connect();
      const page = await browser.newPage();

      // evaluateOnNewDocument should not be called when stealth is false
      expect(mockPage.evaluateOnNewDocument).not.toHaveBeenCalled();
      expect(page).toBeDefined();
    });
  });

  describe('Browser cleanup', () => {
    it('should handle graceful disconnect with no errors', async () => {
      const browser = new ObscuraBrowser(config);
      await browser.connect();
      // Should not throw
      await browser.close();
      expect(mockBrowser.disconnect).toHaveBeenCalled();
    });

    it('should handle close when browser is null', async () => {
      const browser = new ObscuraBrowser(config);
      // Close without connecting should not throw
      await expect(browser.close()).resolves.not.toThrow();
    });

    it('should handle disconnect failure gracefully', async () => {
      mockBrowser.disconnect.mockRejectedValue(new Error('Disconnect failed'));
      const browser = new ObscuraBrowser(config);
      await browser.connect();
      // Should not throw even if disconnect fails
      await expect(browser.close()).resolves.not.toThrow();
    });
  });
});
