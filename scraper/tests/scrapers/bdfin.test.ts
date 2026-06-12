// scraper/tests/scrapers/bdfin.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseBdfinInstruments, parseBdfinMarketActivities } from '../../src/scrapers/bdfin/parsers.js';
import { scrapeBdfinInstruments } from '../../src/scrapers/bdfin/instruments.js';
import { scrapeBdfinMarket } from '../../src/scrapers/bdfin/market.js';
import { runBdfinInstruments } from '../../src/runners/runBdfinInstruments.js';
import { runBdfinMarket } from '../../src/runners/runBdfinMarket.js';
import type { HeadlessBrowser, HeadlessPage } from '../../src/headless/types.js';

// Mock the config module
vi.mock('../../src/config.js', () => ({
  getConfig: vi.fn(() => ({
    BDFIN_BASE_URL: 'https://bdfin.brvm.org',
    BDFIN_LOGIN_PATH: '/login.aspx',
    BDFIN_MARKET_PATH: '/market.aspx',
    BDFIN_USERNAME: 'testuser',
    BDFIN_PASSWORD: 'testpass',
  })),
}));

// Mock the logger module
vi.mock('../../src/logger.js', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Mock persistence repository
vi.mock('../../src/persistence/repository.js', () => ({
  upsertInstruments: vi.fn().mockResolvedValue(3),
  upsertActions: vi.fn().mockResolvedValue(3),
  upsertObligations: vi.fn().mockResolvedValue(1),
}));

// Mock auth
vi.mock('../../src/client/bdfinAuthHeadless.js', () => ({
  loginViaHeadless: vi.fn(),
}));

const __dirname = dirname(fileURLToPath(import.meta.url));
const instrumentsHtml = readFileSync(
  join(__dirname, '..', 'fixtures', 'bdfin-instruments.html'),
  'utf8',
);
const marketHtml = readFileSync(
  join(__dirname, '..', 'fixtures', 'bdfin-market.html'),
  'utf8',
);

describe('BDFIN Parsers', () => {
  describe('parseBdfinInstruments', () => {
    it('should extract all instruments from valid HTML', () => {
      const instruments = parseBdfinInstruments(instrumentsHtml);
      expect(instruments).toHaveLength(3);
    });

    it('should correctly parse SNTS instrument', () => {
      const instruments = parseBdfinInstruments(instrumentsHtml);
      const snts = instruments.find((i) => i.code === 'SNTS');
      expect(snts).toBeDefined();
      expect(snts!.code).toBe('SNTS');
      expect(snts!.designation).toBe('SONATEL');
      expect(snts!.pays).toBe('SN');
      expect(snts!.secteur).toBe('Télécommunications');
      expect(snts!.type).toBe('Action');
      expect(snts!.statut).toBe('Coté');
      expect(snts!.isin).toBe('SN0000000007');
    });

    it('should correctly parse PALC instrument', () => {
      const instruments = parseBdfinInstruments(instrumentsHtml);
      const palc = instruments.find((i) => i.code === 'PALC');
      expect(palc).toBeDefined();
      expect(palc!.designation).toBe('PALMCI');
      expect(palc!.pays).toBe('CI');
      expect(palc!.secteur).toBe('Agro-alimentaire');
    });

    it('should correctly parse SGBC instrument', () => {
      const instruments = parseBdfinInstruments(instrumentsHtml);
      const sgbc = instruments.find((i) => i.code === 'SGBC');
      expect(sgbc).toBeDefined();
      expect(sgbc!.designation).toBe('SOCIETE GENERALE BURKINA');
      expect(sgbc!.pays).toBe('BF');
      expect(sgbc!.secteur).toBe('Finance');
    });

    it('should set scraped_at to ISO date string', () => {
      const instruments = parseBdfinInstruments(instrumentsHtml);
      expect(instruments[0].scraped_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return empty array for HTML without instruments table', () => {
      const emptyHtml = '<html><body>No table here</body></html>';
      const instruments = parseBdfinInstruments(emptyHtml);
      expect(instruments).toEqual([]);
    });

    it('should handle missing optional columns gracefully', () => {
      const minimalHtml = `
        <table id="InstrumentsGrid">
          <thead>
            <tr>
              <th>Code</th>
              <th>Désignation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>TEST</td>
              <td>Test Company</td>
            </tr>
          </tbody>
        </table>
      `;
      const instruments = parseBdfinInstruments(minimalHtml);
      expect(instruments).toHaveLength(1);
      expect(instruments[0].code).toBe('TEST');
      expect(instruments[0].designation).toBe('Test Company');
      expect(instruments[0].pays).toBe('');
      expect(instruments[0].secteur).toBe('');
    });

    it('should skip rows missing code or designation', () => {
      const missingFieldsHtml = `
        <table id="InstrumentsGrid">
          <thead>
            <tr>
              <th>Code</th>
              <th>Désignation</th>
              <th>Pays</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>CODE1</td>
              <td>Company 1</td>
              <td>SN</td>
            </tr>
            <tr>
              <td></td>
              <td>Company 2</td>
              <td>CI</td>
            </tr>
            <tr>
              <td>CODE3</td>
              <td></td>
              <td>BF</td>
            </tr>
          </tbody>
        </table>
      `;
      const instruments = parseBdfinInstruments(missingFieldsHtml);
      expect(instruments).toHaveLength(1);
      expect(instruments[0].code).toBe('CODE1');
    });

    it('should normalize code to uppercase', () => {
      const lowercaseCodeHtml = `
        <table id="InstrumentsGrid">
          <thead>
            <tr>
              <th>Code</th>
              <th>Désignation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>snts</td>
              <td>Sonatel</td>
            </tr>
          </tbody>
        </table>
      `;
      const instruments = parseBdfinInstruments(lowercaseCodeHtml);
      expect(instruments[0].code).toBe('SNTS');
    });
  });

  describe('parseBdfinMarketActivities', () => {
    it('should parse market data for given date', () => {
      const data = parseBdfinMarketActivities(marketHtml, '2026-06-12');
      expect(data.date_marche).toBe('2026-06-12');
    });

    it('should extract all actions from market HTML', () => {
      const data = parseBdfinMarketActivities(marketHtml, '2026-06-12');
      expect(data.actions).toHaveLength(3);
    });

    it('should correctly parse SNTS action data', () => {
      const data = parseBdfinMarketActivities(marketHtml, '2026-06-12');
      const snts = data.actions.find((a) => a.code === 'SNTS');
      expect(snts).toBeDefined();
      expect(snts!.code).toBe('SNTS');
      expect(snts!.designation).toBe('SONATEL');
      expect(snts!.cours_jour).toBe(14800);
      expect(snts!.cours_precedent).toBe(14500);
      expect(snts!.variation_pct).toBeCloseTo(2.07, 1);
      expect(snts!.volume).toBe(1240);
      expect(snts!.nb_transactions).toBe(25);
      expect(snts!.valeur_echangee).toBe(18352000);
    });

    it('should correctly parse PALC action data', () => {
      const data = parseBdfinMarketActivities(marketHtml, '2026-06-12');
      const palc = data.actions.find((a) => a.code === 'PALC');
      expect(palc).toBeDefined();
      expect(palc!.cours_jour).toBe(9850);
      expect(palc!.cours_precedent).toBe(9800);
      expect(palc!.variation_pct).toBeCloseTo(0.51, 1);
    });

    it('should handle negative variation percentages', () => {
      const data = parseBdfinMarketActivities(marketHtml, '2026-06-12');
      const sgbc = data.actions.find((a) => a.code === 'SGBC');
      expect(sgbc).toBeDefined();
      expect(sgbc!.variation_pct).toBeCloseTo(-0.83, 1);
    });

    it('should extract obligations separately', () => {
      const data = parseBdfinMarketActivities(marketHtml, '2026-06-12');
      expect(data.obligations).toHaveLength(1);
      const obl = data.obligations[0];
      expect(obl.code).toBe('CI0000000001');
      expect(obl.designation).toBe('TPCI 6.25% 2025');
      expect(obl.cours_jour).toBe(10075);
    });

    it('should initialize empty actions and obligations arrays for missing tables', () => {
      const noTablesHtml = '<html><body>No tables</body></html>';
      const data = parseBdfinMarketActivities(noTablesHtml, '2026-06-12');
      expect(data.actions).toEqual([]);
      expect(data.obligations).toEqual([]);
    });

    it('should initialize summary with zero values', () => {
      const data = parseBdfinMarketActivities(marketHtml, '2026-06-12');
      expect(data.summary).toBeDefined();
      expect(data.summary.valeur_transactions).toBeGreaterThanOrEqual(0);
      expect(data.summary.capitalisation_actions).toBe(0);
      expect(data.summary.capitalisation_obligations).toBe(0);
    });

    it('should skip rows missing code column', () => {
      const missingCodeHtml = `
        <table id="ActionsGrid">
          <thead>
            <tr>
              <th>Code</th>
              <th>Désignation</th>
              <th>Cours jour</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>CODE1</td>
              <td>Company 1</td>
              <td>100</td>
            </tr>
            <tr>
              <td></td>
              <td>Company 2</td>
              <td>200</td>
            </tr>
          </tbody>
        </table>
      `;
      const data = parseBdfinMarketActivities(missingCodeHtml, '2026-06-12');
      expect(data.actions).toHaveLength(1);
      expect(data.actions[0].code).toBe('CODE1');
    });

    it('should handle missing numeric columns as zero', () => {
      const missingNumericHtml = `
        <table id="ActionsGrid">
          <thead>
            <tr>
              <th>Code</th>
              <th>Désignation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>TEST</td>
              <td>Test Company</td>
            </tr>
          </tbody>
        </table>
      `;
      const data = parseBdfinMarketActivities(missingNumericHtml, '2026-06-12');
      expect(data.actions).toHaveLength(1);
      const row = data.actions[0];
      expect(row.cours_jour).toBe(0);
      expect(row.cours_precedent).toBe(0);
      expect(row.variation_pct).toBe(0);
      expect(row.volume).toBe(0);
    });

    it('should normalize codes to uppercase', () => {
      const lowercaseHtml = `
        <table id="ActionsGrid">
          <thead>
            <tr>
              <th>Code</th>
              <th>Désignation</th>
              <th>Cours jour</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>snts</td>
              <td>Sonatel</td>
              <td>100</td>
            </tr>
          </tbody>
        </table>
      `;
      const data = parseBdfinMarketActivities(lowercaseHtml, '2026-06-12');
      expect(data.actions[0].code).toBe('SNTS');
    });
  });
});

describe('BDFIN Scrapers', () => {
  let mockPage: any;
  let mockBrowser: any;

  beforeEach(() => {
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockResolvedValue(instrumentsHtml),
      setCookie: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      type: vi.fn().mockResolvedValue(undefined),
    };

    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
    } as unknown as HeadlessBrowser;

    // Setup default mock for auth
    const { loginViaHeadless } = vi.hoisted(() => {
      return {
        loginViaHeadless: vi.fn(),
      };
    });

    vi.mocked((loginViaHeadless as any)).mockResolvedValue({
      success: true,
      finalUrl: 'https://bdfin.brvm.org/dashboard.aspx',
      cookies: [
        { name: 'ASP.NET_SessionId', value: 'abc123' },
        { name: '.ASPXAUTH', value: 'token456' },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('scrapeBdfinInstruments', () => {
    it('should successfully scrape instruments', async () => {
      const { loginViaHeadless } = await import('../../src/client/bdfinAuthHeadless.js');
      vi.mocked(loginViaHeadless).mockResolvedValue({
        success: true,
        finalUrl: 'https://bdfin.brvm.org/dashboard.aspx',
        cookies: [{ name: 'session', value: 'token' }],
      });
      mockPage.content.mockResolvedValue(instrumentsHtml);

      const result = await scrapeBdfinInstruments(mockBrowser);

      expect(result.status).toBe('success');
      expect(result.instruments).toBeDefined();
      expect(result.instruments).toHaveLength(3);
      expect(result.error).toBeUndefined();
    });

    it('should return error when authentication fails', async () => {
      const { loginViaHeadless } = await import('../../src/client/bdfinAuthHeadless.js');
      vi.mocked(loginViaHeadless).mockResolvedValue({
        success: false,
        finalUrl: 'https://bdfin.brvm.org/login.aspx',
        cookies: [],
      });

      const result = await scrapeBdfinInstruments(mockBrowser);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('authentication failed');
      expect(result.instruments).toBeUndefined();
    });

    it('should return error when no instruments are parsed', async () => {
      const { loginViaHeadless } = await import('../../src/client/bdfinAuthHeadless.js');
      vi.mocked(loginViaHeadless).mockResolvedValue({
        success: true,
        finalUrl: 'https://bdfin.brvm.org/dashboard.aspx',
        cookies: [{ name: 'session', value: 'token' }],
      });
      mockPage.content.mockResolvedValue('<html><body>No instruments</body></html>');

      const result = await scrapeBdfinInstruments(mockBrowser);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('No instruments found');
    });

    it('should close the page after successful scrape', async () => {
      const { loginViaHeadless } = await import('../../src/client/bdfinAuthHeadless.js');
      vi.mocked(loginViaHeadless).mockResolvedValue({
        success: true,
        finalUrl: 'https://bdfin.brvm.org/dashboard.aspx',
        cookies: [{ name: 'session', value: 'token' }],
      });
      mockPage.content.mockResolvedValue(instrumentsHtml);

      await scrapeBdfinInstruments(mockBrowser);

      expect(mockPage.close).toHaveBeenCalled();
    });

    it('should close the page even on exception', async () => {
      mockPage.goto.mockRejectedValue(new Error('Network error'));

      await scrapeBdfinInstruments(mockBrowser);

      expect(mockPage.close).toHaveBeenCalled();
    });

    it('should handle exceptions and return error status', async () => {
      mockPage.goto.mockRejectedValue(new Error('Network timeout'));

      const result = await scrapeBdfinInstruments(mockBrowser);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Network timeout');
    });

    it('should set cookies from auth result', async () => {
      const { loginViaHeadless } = await import('../../src/client/bdfinAuthHeadless.js');
      vi.mocked(loginViaHeadless).mockResolvedValue({
        success: true,
        finalUrl: 'https://bdfin.brvm.org/dashboard.aspx',
        cookies: [
          { name: 'session1', value: 'val1' },
          { name: 'session2', value: 'val2' },
        ],
      });
      mockPage.content.mockResolvedValue(instrumentsHtml);

      await scrapeBdfinInstruments(mockBrowser);

      expect(mockPage.setCookie).toHaveBeenCalledWith({
        name: 'session1',
        value: 'val1',
      });
      expect(mockPage.setCookie).toHaveBeenCalledWith({
        name: 'session2',
        value: 'val2',
      });
    });

    it('should navigate to instruments URL', async () => {
      const { loginViaHeadless } = await import('../../src/client/bdfinAuthHeadless.js');
      vi.mocked(loginViaHeadless).mockResolvedValue({
        success: true,
        finalUrl: 'https://bdfin.brvm.org/dashboard.aspx',
        cookies: [{ name: 'session', value: 'token' }],
      });
      mockPage.content.mockResolvedValue(instrumentsHtml);

      await scrapeBdfinInstruments(mockBrowser);

      expect(mockPage.goto).toHaveBeenCalledWith('https://bdfin.brvm.org/Instruments.aspx', {
        waitUntil: 'networkidle2',
      });
    });
  });

  describe('scrapeBdfinMarket', () => {
    it('should successfully scrape market data without target date', async () => {
      const { loginViaHeadless } = await import('../../src/client/bdfinAuthHeadless.js');
      vi.mocked(loginViaHeadless).mockResolvedValue({
        success: true,
        finalUrl: 'https://bdfin.brvm.org/dashboard.aspx',
        cookies: [{ name: 'session', value: 'token' }],
      });
      mockPage.content.mockResolvedValue(marketHtml);

      const result = await scrapeBdfinMarket(mockBrowser);

      expect(result.status).toBe('success');
      expect(result.data).toBeDefined();
      expect(result.data!.actions).toHaveLength(3);
      expect(result.data!.obligations).toHaveLength(1);
      expect(result.error).toBeUndefined();
    });

    it('should successfully scrape market data with target date', async () => {
      const { loginViaHeadless } = await import('../../src/client/bdfinAuthHeadless.js');
      vi.mocked(loginViaHeadless).mockResolvedValue({
        success: true,
        finalUrl: 'https://bdfin.brvm.org/dashboard.aspx',
        cookies: [{ name: 'session', value: 'token' }],
      });
      mockPage.content.mockResolvedValue(marketHtml);

      const result = await scrapeBdfinMarket(mockBrowser, '2026-06-11');

      expect(result.status).toBe('success');
      expect(result.data!.date_marche).toBe('2026-06-11');
    });

    it('should return error when authentication fails', async () => {
      const { loginViaHeadless } = await import('../../src/client/bdfinAuthHeadless.js');
      vi.mocked(loginViaHeadless).mockResolvedValue({
        success: false,
        finalUrl: 'https://bdfin.brvm.org/login.aspx',
        cookies: [],
      });

      const result = await scrapeBdfinMarket(mockBrowser);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('authentication failed');
    });

    it('should return error when no data is parsed', async () => {
      const { loginViaHeadless } = await import('../../src/client/bdfinAuthHeadless.js');
      vi.mocked(loginViaHeadless).mockResolvedValue({
        success: true,
        finalUrl: 'https://bdfin.brvm.org/dashboard.aspx',
        cookies: [{ name: 'session', value: 'token' }],
      });
      mockPage.content.mockResolvedValue('<html><body>No data</body></html>');

      const result = await scrapeBdfinMarket(mockBrowser);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('No market data found');
    });

    it('should close the page after scrape', async () => {
      const { loginViaHeadless } = await import('../../src/client/bdfinAuthHeadless.js');
      vi.mocked(loginViaHeadless).mockResolvedValue({
        success: true,
        finalUrl: 'https://bdfin.brvm.org/dashboard.aspx',
        cookies: [{ name: 'session', value: 'token' }],
      });
      mockPage.content.mockResolvedValue(marketHtml);

      await scrapeBdfinMarket(mockBrowser);

      expect(mockPage.close).toHaveBeenCalled();
    });

    it('should close the page even on exception', async () => {
      mockPage.goto.mockRejectedValue(new Error('Network error'));

      await scrapeBdfinMarket(mockBrowser);

      expect(mockPage.close).toHaveBeenCalled();
    });

    it('should use current date when target date not provided', async () => {
      const { loginViaHeadless } = await import('../../src/client/bdfinAuthHeadless.js');
      vi.mocked(loginViaHeadless).mockResolvedValue({
        success: true,
        finalUrl: 'https://bdfin.brvm.org/dashboard.aspx',
        cookies: [{ name: 'session', value: 'token' }],
      });
      mockPage.content.mockResolvedValue(marketHtml);

      const result = await scrapeBdfinMarket(mockBrowser);

      expect(result.data!.date_marche).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should navigate to market URL', async () => {
      const { loginViaHeadless } = await import('../../src/client/bdfinAuthHeadless.js');
      vi.mocked(loginViaHeadless).mockResolvedValue({
        success: true,
        finalUrl: 'https://bdfin.brvm.org/dashboard.aspx',
        cookies: [{ name: 'session', value: 'token' }],
      });
      mockPage.content.mockResolvedValue(marketHtml);

      await scrapeBdfinMarket(mockBrowser);

      expect(mockPage.goto).toHaveBeenCalledWith('https://bdfin.brvm.org/market.aspx', {
        waitUntil: 'networkidle2',
      });
    });

    it('should handle scrape errors gracefully', async () => {
      mockPage.goto.mockRejectedValue(new Error('Connection refused'));

      const result = await scrapeBdfinMarket(mockBrowser);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Connection refused');
    });
  });
});

describe('BDFIN Runners', () => {
  let mockPage: any;
  let mockBrowser: any;

  beforeEach(() => {
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockResolvedValue(instrumentsHtml),
      setCookie: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      type: vi.fn().mockResolvedValue(undefined),
    };

    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
    } as unknown as HeadlessBrowser;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('runBdfinInstruments', () => {
    it('should successfully scrape and persist instruments', async () => {
      const { loginViaHeadless } = await import('../../src/client/bdfinAuthHeadless.js');
      vi.mocked(loginViaHeadless).mockResolvedValue({
        success: true,
        finalUrl: 'https://bdfin.brvm.org/dashboard.aspx',
        cookies: [{ name: 'session', value: 'token' }],
      });
      mockPage.content.mockResolvedValue(instrumentsHtml);

      const result = await runBdfinInstruments(mockBrowser);

      expect(result.status).toBe('success');
      expect(result.count).toBe(3);
      expect(result.error).toBeUndefined();
    });

    it('should return failed status when scrape fails', async () => {
      mockPage.goto.mockRejectedValue(new Error('Network error'));

      const result = await runBdfinInstruments(mockBrowser);

      expect(result.status).toBe('failed');
      expect(result.count).toBe(0);
      expect(result.error).toBeDefined();
    });

    it('should return error message when scrape fails', async () => {
      mockPage.goto.mockRejectedValue(new Error('Timeout'));

      const result = await runBdfinInstruments(mockBrowser);

      expect(result.error).toContain('Timeout');
    });
  });

  describe('runBdfinMarket', () => {
    it('should successfully scrape and persist market data', async () => {
      const { loginViaHeadless } = await import('../../src/client/bdfinAuthHeadless.js');
      vi.mocked(loginViaHeadless).mockResolvedValue({
        success: true,
        finalUrl: 'https://bdfin.brvm.org/dashboard.aspx',
        cookies: [{ name: 'session', value: 'token' }],
      });
      mockPage.content.mockResolvedValue(marketHtml);

      const result = await runBdfinMarket(mockBrowser);

      expect(result.status).toBe('success');
      expect(result.actions).toBe(3);
      expect(result.obligations).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it('should successfully handle target date parameter', async () => {
      const { loginViaHeadless } = await import('../../src/client/bdfinAuthHeadless.js');
      vi.mocked(loginViaHeadless).mockResolvedValue({
        success: true,
        finalUrl: 'https://bdfin.brvm.org/dashboard.aspx',
        cookies: [{ name: 'session', value: 'token' }],
      });
      mockPage.content.mockResolvedValue(marketHtml);

      const result = await runBdfinMarket(mockBrowser, '2026-06-11');

      expect(result.status).toBe('success');
    });

    it('should return failed status when scrape fails', async () => {
      mockPage.goto.mockRejectedValue(new Error('Connection error'));

      const result = await runBdfinMarket(mockBrowser);

      expect(result.status).toBe('failed');
      expect(result.actions).toBe(0);
      expect(result.obligations).toBe(0);
      expect(result.error).toBeDefined();
    });

    it('should return error message when scrape fails', async () => {
      mockPage.goto.mockRejectedValue(new Error('Parse error'));

      const result = await runBdfinMarket(mockBrowser);

      expect(result.error).toContain('Parse error');
    });
  });
});
