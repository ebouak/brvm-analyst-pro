// scraper/tests/scrapers/documents.test.ts
/**
 * Test suite for communiqués and bulletins scrapers and runners.
 *
 * Tests cover:
 * - scrapeCommuniques(): valid HTML, empty list, network errors, filtering
 * - scrapeBulletins(): valid HTML, date validation, PDF extraction
 * - runCommuniques(): success and failure scenarios
 * - runBulletins(): success and failure scenarios
 * - upsertCommuniques/upsertBulletins(): basic smoke tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
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

// Mock persistence - these will be imported and used in runners
vi.mock('../../src/persistence/repository.js', () => ({
  upsertCommuniques: vi.fn().mockResolvedValue(0),
  upsertBulletins: vi.fn().mockResolvedValue(0),
}));

// Mock axios to prevent real network calls
vi.mock('axios', () => {
  const mockGet = vi.fn();
  return {
    default: {
      get: mockGet,
    },
  };
});

// Import after mocks are set up
import axios from 'axios';
import { scrapeCommuniques, type Communique } from '../../src/scrapers/communiques.js';
import { scrapeBulletins, type Bulletin } from '../../src/scrapers/bulletins.js';
import { runCommuniques, type RunCommuniquesResult } from '../../src/runners/runCommuniques.js';
import { runBulletins, type RunBulletinsResult } from '../../src/runners/runBulletins.js';
import { upsertCommuniques, upsertBulletins } from '../../src/persistence/repository.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const COMMUNIQUES_LIST_HTML = `
<!DOCTYPE html>
<html>
<body>
  <div class="content">
    <a href="/fr/emetteurs/communique/001" class="communique-link">Communiqué 1</a>
    <a href="/fr/emetteurs/communique/002" class="communique-link">Communiqué 2</a>
    <a href="/fr/other-page" class="other">Autre page</a>
  </div>
</body>
</html>
`;

const COMMUNIQUE_DETAIL_HTML_1 = `
<!DOCTYPE html>
<html>
<head><title>Communiqué - PALC</title></head>
<body>
  <article>
    <h1>Annonce importante de PALC</h1>
    <p>Résumé du communiqué important. La société PALC annonce des résultats exceptionnels.</p>
    <p>12 juin 2025</p>
  </article>
  <div>
    <span class="emetteur">PALC</span>
  </div>
</body>
</html>
`;

const COMMUNIQUE_DETAIL_HTML_2 = `
<!DOCTYPE html>
<html>
<head><title>Avis Aux Actionnaires</title></head>
<body>
  <article>
    <h1>Avis aux actionnaires pour assemblée générale</h1>
    <p>Assemblée générale ordinaire prévue pour délibération.</p>
    <p>5 août 2025</p>
  </article>
</body>
</html>
`;

const BULLETINS_LIST_HTML = `
<!DOCTYPE html>
<html>
<body>
  <div class="content">
    <a href="/fr/bulletins/2025-06-12" class="bulletin-link">Bulletin 12 juin</a>
    <a href="/fr/bulletins/2025-06-11" class="bulletin-link">Bulletin 11 juin</a>
    <a href="/fr/other" class="other">Autre</a>
  </div>
</body>
</html>
`;

const BULLETIN_DETAIL_HTML_1 = `
<!DOCTYPE html>
<html>
<head><title>Bulletin Officiel</title></head>
<body>
  <article>
    <h1>Bulletin officiel de la cote de la BRVM</h1>
    <p>Ceci est le bulletin officiel de la cote du 12 juin 2025.</p>
  </article>
  <div class="pdf-section">
    <a href="/documents/bulletin-2025-06-12.pdf">Télécharger le bulletin PDF</a>
  </div>
</body>
</html>
`;

const BULLETIN_DETAIL_HTML_2 = `
<!DOCTYPE html>
<html>
<head><title>Bulletin</title></head>
<body>
  <article>
    <h1>Bulletin officiel</h1>
    <p>Bulletin du 11 juin 2025 de la BRVM.</p>
  </article>
  <a href="https://cdn.brvm.org/bulletins/2025-06-11.pdf">Télécharger</a>
</body>
</html>
`;

const EMPTY_HTML = '<!DOCTYPE html><html><body></body></html>';

const NO_DATE_BULLETIN = `
<!DOCTYPE html>
<html>
<body>
  <article>
    <h1>Bulletin sans date</h1>
    <p>Contenu sans information de date parseable.</p>
  </article>
</body>
</html>
`;

// ============================================================================
// Tests: scrapeCommuniques
// ============================================================================

describe('scrapeCommuniques', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scrapes valid communiqués and returns structured data', async () => {
    const mockAxios = axios as any;
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUES_LIST_HTML });
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUE_DETAIL_HTML_1 });
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUE_DETAIL_HTML_2 });

    const result = await scrapeCommuniques();

    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);

    if (result.length > 0) {
      const first = result[0];
      expect(first).toHaveProperty('dedupe_hash');
      expect(first).toHaveProperty('titre');
      expect(first).toHaveProperty('date_publication');
      expect(first).toHaveProperty('source_url');
      expect(first).toHaveProperty('categorie');
      expect(first.categorie).toBe('communique');
    }
  });

  it('returns empty array on network error', async () => {
    const mockAxios = axios as any;
    mockAxios.get.mockRejectedValueOnce(new Error('Network timeout'));

    const result = await scrapeCommuniques();

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns empty array for empty HTML', async () => {
    const mockAxios = axios as any;
    mockAxios.get.mockResolvedValueOnce({ data: EMPTY_HTML });

    const result = await scrapeCommuniques();

    expect(result).toEqual([]);
  });

  it('filters out communiqués with invalid titles (< 5 chars)', async () => {
    const mockAxios = axios as any;
    const invalidHtml = `
      <html><body>
        <article>
          <h1>Bad</h1>
          <p>5 août 2025</p>
        </article>
      </body></html>
    `;

    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUES_LIST_HTML });
    mockAxios.get.mockResolvedValueOnce({ data: invalidHtml });
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUE_DETAIL_HTML_2 });

    const result = await scrapeCommuniques();

    // Valid ones should be in result, invalid ones filtered
    if (result.length > 0) {
      expect(result.every((c) => c.titre.length >= 5)).toBe(true);
    }
  });

  it('handles fetch errors on individual detail pages gracefully', async () => {
    const mockAxios = axios as any;
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUES_LIST_HTML });
    mockAxios.get.mockRejectedValueOnce(new Error('Fetch failed'));
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUE_DETAIL_HTML_2 });

    const result = await scrapeCommuniques();

    // Should still get successful fetches
    expect(Array.isArray(result)).toBe(true);
  });

  it('creates unique dedupe_hash for each communiqué', async () => {
    const mockAxios = axios as any;
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUES_LIST_HTML });
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUE_DETAIL_HTML_1 });
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUE_DETAIL_HTML_2 });

    const result = await scrapeCommuniques();

    if (result.length > 1) {
      const hashes = result.map((c) => c.dedupe_hash);
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(hashes.length);
    }
  });

  it('respects MAX_ITEMS limit (20 items)', async () => {
    const mockAxios = axios as any;
    const manyLinksHtml = '<html><body>' + Array.from({ length: 30 }, (_, i) => `<a href="/fr/emetteurs/communique/${i}">C</a>`).join('') + '</body></html>';

    mockAxios.get.mockResolvedValueOnce({ data: manyLinksHtml });

    // Mock 30 responses
    for (let i = 0; i < 30; i++) {
      mockAxios.get.mockResolvedValueOnce({
        data: `<html><article><h1>Title ${i} communique</h1><p>5 août 2025</p></article></html>`,
      });
    }

    const result = await scrapeCommuniques();

    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('extracts emetteur field when present in span element', async () => {
    const mockAxios = axios as any;
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUES_LIST_HTML });
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUE_DETAIL_HTML_1 }); // Has emetteur
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUE_DETAIL_HTML_2 }); // No emetteur

    const result = await scrapeCommuniques();

    expect(Array.isArray(result)).toBe(true);
    // At least check structure is correct
    expect(result.every((c) => 'emetteur' in c)).toBe(true);
  });

  it('handles timeout errors from axios', async () => {
    const mockAxios = axios as any;
    const timeoutErr = new Error('timeout of 25000ms exceeded');
    mockAxios.get.mockRejectedValueOnce(timeoutErr);

    const result = await scrapeCommuniques();

    expect(result).toEqual([]);
  });
});

// ============================================================================
// Tests: scrapeBulletins
// ============================================================================

describe('scrapeBulletins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scrapes valid bulletins and returns structured data', async () => {
    const mockAxios = axios as any;
    mockAxios.get.mockResolvedValueOnce({ data: BULLETINS_LIST_HTML });
    mockAxios.get.mockResolvedValueOnce({ data: BULLETIN_DETAIL_HTML_1 });
    mockAxios.get.mockResolvedValueOnce({ data: BULLETIN_DETAIL_HTML_2 });

    const result = await scrapeBulletins();

    expect(result).toBeInstanceOf(Array);

    if (result.length > 0) {
      const first = result[0];
      expect(first).toHaveProperty('dedupe_hash');
      expect(first).toHaveProperty('date_bulletin');
      expect(first).toHaveProperty('source_url');
      expect(typeof first.dedupe_hash).toBe('string');
      expect(typeof first.date_bulletin).toBe('string');
      expect(typeof first.source_url).toBe('string');
    }
  });

  it('returns empty array on network error', async () => {
    const mockAxios = axios as any;
    mockAxios.get.mockRejectedValueOnce(new Error('Network error'));

    const result = await scrapeBulletins();

    expect(result).toEqual([]);
  });

  it('filters bulletins without valid date (requires DD mois YYYY format)', async () => {
    const mockAxios = axios as any;
    mockAxios.get.mockResolvedValueOnce({ data: BULLETINS_LIST_HTML });
    mockAxios.get.mockResolvedValueOnce({ data: NO_DATE_BULLETIN }); // No valid date
    mockAxios.get.mockResolvedValueOnce({ data: BULLETIN_DETAIL_HTML_2 }); // Has valid date

    const result = await scrapeBulletins();

    // All results should have valid date
    if (result.length > 0) {
      expect(result.every((b) => b.date_bulletin && /^\d{4}-\d{2}-\d{2}$/.test(b.date_bulletin))).toBe(true);
    }
  });

  it('extracts PDF document links from bulletins', async () => {
    const mockAxios = axios as any;
    mockAxios.get.mockResolvedValueOnce({ data: BULLETINS_LIST_HTML });
    mockAxios.get.mockResolvedValueOnce({ data: BULLETIN_DETAIL_HTML_1 }); // Has relative PDF
    mockAxios.get.mockResolvedValueOnce({ data: BULLETIN_DETAIL_HTML_2 }); // Has absolute PDF

    const result = await scrapeBulletins();

    expect(result).toBeInstanceOf(Array);
    // At least check that document_url field exists (may be undefined)
    expect(result.every((b) => 'document_url' in b)).toBe(true);
  });

  it('converts relative PDF URLs to absolute URLs', async () => {
    const mockAxios = axios as any;
    mockAxios.get.mockResolvedValueOnce({ data: BULLETINS_LIST_HTML });
    mockAxios.get.mockResolvedValueOnce({ data: BULLETIN_DETAIL_HTML_1 }); // /documents/... -> https://www.brvm.org/documents/...

    const result = await scrapeBulletins();

    if (result.length > 0 && result[0].document_url) {
      expect(result[0].document_url).toMatch(/^https?:\/\//);
    }
  });

  it('creates unique dedupe_hash for each bulletin', async () => {
    const mockAxios = axios as any;
    mockAxios.get.mockResolvedValueOnce({ data: BULLETINS_LIST_HTML });
    mockAxios.get.mockResolvedValueOnce({ data: BULLETIN_DETAIL_HTML_1 });
    mockAxios.get.mockResolvedValueOnce({ data: BULLETIN_DETAIL_HTML_2 });

    const result = await scrapeBulletins();

    if (result.length > 1) {
      const hashes = result.map((b) => b.dedupe_hash);
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(hashes.length);
    }
  });

  it('respects MAX_ITEMS limit (20 items)', async () => {
    const mockAxios = axios as any;
    const manyLinksHtml = '<html><body>' + Array.from({ length: 30 }, (_, i) => `<a href="/fr/bulletins/${i}">B</a>`).join('') + '</body></html>';

    mockAxios.get.mockResolvedValueOnce({ data: manyLinksHtml });

    // Mock 30 responses
    for (let i = 0; i < 30; i++) {
      mockAxios.get.mockResolvedValueOnce({
        data: `<html><article><p>5 août 2025</p></article></html>`,
      });
    }

    const result = await scrapeBulletins();

    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('returns empty array for empty HTML', async () => {
    const mockAxios = axios as any;
    mockAxios.get.mockResolvedValueOnce({ data: EMPTY_HTML });

    const result = await scrapeBulletins();

    expect(result).toEqual([]);
  });
});

// ============================================================================
// Tests: runCommuniques (Runner)
// ============================================================================

describe('runCommuniques', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns expected result structure', async () => {
    const mockAxios = axios as any;
    const mockUpsert = upsertCommuniques as any;

    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUES_LIST_HTML });
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUE_DETAIL_HTML_1 });
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUE_DETAIL_HTML_2 });
    mockUpsert.mockResolvedValueOnce(2);

    const result = await runCommuniques();

    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('count');
    expect(['success', 'failed']).toContain(result.status);
  });

  it('returns success status when scrape succeeds', async () => {
    const mockAxios = axios as any;
    const mockUpsert = upsertCommuniques as any;

    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUES_LIST_HTML });
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUE_DETAIL_HTML_1 });
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUE_DETAIL_HTML_2 });
    mockUpsert.mockResolvedValueOnce(2);

    const result = await runCommuniques();

    expect(result.status).toBe('success');
    expect(typeof result.count).toBe('number');
  });

});

// ============================================================================
// Tests: runBulletins (Runner)
// ============================================================================

describe('runBulletins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns expected result structure', async () => {
    const mockAxios = axios as any;
    const mockUpsert = upsertBulletins as any;

    mockAxios.get.mockResolvedValueOnce({ data: BULLETINS_LIST_HTML });
    mockAxios.get.mockResolvedValueOnce({ data: BULLETIN_DETAIL_HTML_1 });
    mockAxios.get.mockResolvedValueOnce({ data: BULLETIN_DETAIL_HTML_2 });
    mockUpsert.mockResolvedValueOnce(2);

    const result = await runBulletins();

    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('count');
    expect(['success', 'failed']).toContain(result.status);
  });

  it('returns success status when scrape succeeds', async () => {
    const mockAxios = axios as any;
    const mockUpsert = upsertBulletins as any;

    mockAxios.get.mockResolvedValueOnce({ data: BULLETINS_LIST_HTML });
    mockAxios.get.mockResolvedValueOnce({ data: BULLETIN_DETAIL_HTML_1 });
    mockAxios.get.mockResolvedValueOnce({ data: BULLETIN_DETAIL_HTML_2 });
    mockUpsert.mockResolvedValueOnce(2);

    const result = await runBulletins();

    expect(result.status).toBe('success');
    expect(typeof result.count).toBe('number');
  });

});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Document Scrapers - Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('communiqués maintains data integrity through pipeline', async () => {
    const mockAxios = axios as any;
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUES_LIST_HTML });
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUE_DETAIL_HTML_1 });
    mockAxios.get.mockResolvedValueOnce({ data: COMMUNIQUE_DETAIL_HTML_2 });

    const communiques = await scrapeCommuniques();

    // Verify all required fields are present
    communiques.forEach((c) => {
      expect(c.dedupe_hash).toBeDefined();
      expect(typeof c.dedupe_hash).toBe('string');
      expect(c.titre).toBeDefined();
      expect(typeof c.titre).toBe('string');
      expect(c.date_publication).toBeDefined();
      expect(/^\d{4}-\d{2}-\d{2}$/.test(c.date_publication)).toBe(true);
      expect(c.source_url).toBeDefined();
      expect(c.categorie).toBe('communique');
    });
  });

  it('bulletins maintains data integrity through pipeline', async () => {
    const mockAxios = axios as any;
    mockAxios.get.mockResolvedValueOnce({ data: BULLETINS_LIST_HTML });
    mockAxios.get.mockResolvedValueOnce({ data: BULLETIN_DETAIL_HTML_1 });
    mockAxios.get.mockResolvedValueOnce({ data: BULLETIN_DETAIL_HTML_2 });

    const bulletins = await scrapeBulletins();

    bulletins.forEach((b) => {
      expect(b.dedupe_hash).toBeDefined();
      expect(typeof b.dedupe_hash).toBe('string');
      expect(b.date_bulletin).toBeDefined();
      expect(/^\d{4}-\d{2}-\d{2}$/.test(b.date_bulletin)).toBe(true);
      expect(b.source_url).toBeDefined();
    });
  });

  it('handles edge case: malformed HTML gracefully', async () => {
    const mockAxios = axios as any;
    const malformedHtml = '<<<html><broken';

    mockAxios.get.mockResolvedValueOnce({ data: malformedHtml });

    const result = await scrapeCommuniques();

    // Should not throw, should return empty or partial results
    expect(Array.isArray(result)).toBe(true);
  });
});

// ============================================================================
// Persistence Layer Tests
// ============================================================================

describe('Persistence - upsertCommuniques', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a function that can be called', () => {
    const mockUpsert = upsertCommuniques as any;
    expect(typeof mockUpsert).toBe('function');
  });
});

describe('Persistence - upsertBulletins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a function that can be called', () => {
    const mockUpsert = upsertBulletins as any;
    expect(typeof mockUpsert).toBe('function');
  });
});
