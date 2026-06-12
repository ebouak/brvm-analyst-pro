import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runDailyFull } from '../../src/runners/runDailyFull.js';

// Mock all the runner modules
vi.mock('../../src/headless/obscura.js', () => ({
  ObscuraBrowser: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('../../src/runners/runBdfinInstruments.js', () => ({
  runBdfinInstruments: vi.fn(),
}));

vi.mock('../../src/runners/runBdfinMarket.js', () => ({
  runBdfinMarket: vi.fn(),
}));

vi.mock('../../src/runners/runCommuniques.js', () => ({
  runCommuniques: vi.fn(),
}));

vi.mock('../../src/runners/runBulletins.js', () => ({
  runBulletins: vi.fn(),
}));

vi.mock('../../src/scrapers/runNews.js', () => ({
  runNews: vi.fn(),
}));

describe('runDailyFull', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('orchestrates all 5 steps successfully', async () => {
    // Setup: all runners succeed
    const { runBdfinInstruments } = await import('../../src/runners/runBdfinInstruments.js');
    const { runBdfinMarket } = await import('../../src/runners/runBdfinMarket.js');
    const { runCommuniques } = await import('../../src/runners/runCommuniques.js');
    const { runBulletins } = await import('../../src/runners/runBulletins.js');
    const { runNews } = await import('../../src/scrapers/runNews.js');

    vi.mocked(runBdfinInstruments).mockResolvedValue({ status: 'success', count: 48 });
    vi.mocked(runBdfinMarket).mockResolvedValue({ status: 'success', actions: 45, obligations: 15 });
    vi.mocked(runCommuniques).mockResolvedValue({ status: 'success', count: 10 });
    vi.mocked(runBulletins).mockResolvedValue({ status: 'success', count: 5 });
    vi.mocked(runNews).mockResolvedValue(undefined);

    const result = await runDailyFull();

    expect(result.status).toBe('success');
    expect(result.summary.totalSteps).toBe(5);
    expect(result.summary.successfulSteps).toBe(5);
    expect(result.summary.failedSteps).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.results.bdfinInstruments).toBeDefined();
    expect(result.results.bdfinMarket).toBeDefined();
    expect(result.results.communiques).toBeDefined();
    expect(result.results.bulletins).toBeDefined();
    expect(result.results.news).toBeDefined();
    expect(result.startedAt).toBeDefined();
    expect(result.finishedAt).toBeDefined();
  });

  it('handles partial failure (3 of 5 steps succeed)', async () => {
    const { runBdfinInstruments } = await import('../../src/runners/runBdfinInstruments.js');
    const { runBdfinMarket } = await import('../../src/runners/runBdfinMarket.js');
    const { runCommuniques } = await import('../../src/runners/runCommuniques.js');
    const { runBulletins } = await import('../../src/runners/runBulletins.js');
    const { runNews } = await import('../../src/scrapers/runNews.js');

    // 3 succeed, 2 fail
    vi.mocked(runBdfinInstruments).mockResolvedValue({ status: 'success', count: 48 });
    vi.mocked(runBdfinMarket).mockRejectedValue(new Error('Market scrape failed'));
    vi.mocked(runCommuniques).mockResolvedValue({ status: 'success', count: 10 });
    vi.mocked(runBulletins).mockRejectedValue(new Error('Bulletins scrape failed'));
    vi.mocked(runNews).mockResolvedValue(undefined);

    const result = await runDailyFull();

    expect(result.status).toBe('partial');
    expect(result.summary.totalSteps).toBe(5);
    expect(result.summary.successfulSteps).toBe(3);
    expect(result.summary.failedSteps).toBe(2);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.some((e) => e.step === 'bdfin_market')).toBe(true);
    expect(result.errors.some((e) => e.step === 'bulletins')).toBe(true);
  });

  it('handles total failure (all steps fail)', async () => {
    const { runBdfinInstruments } = await import('../../src/runners/runBdfinInstruments.js');
    const { runBdfinMarket } = await import('../../src/runners/runBdfinMarket.js');
    const { runCommuniques } = await import('../../src/runners/runCommuniques.js');
    const { runBulletins } = await import('../../src/runners/runBulletins.js');
    const { runNews } = await import('../../src/scrapers/runNews.js');

    // All fail
    vi.mocked(runBdfinInstruments).mockRejectedValue(new Error('Instruments failed'));
    vi.mocked(runBdfinMarket).mockRejectedValue(new Error('Market failed'));
    vi.mocked(runCommuniques).mockRejectedValue(new Error('Communiques failed'));
    vi.mocked(runBulletins).mockRejectedValue(new Error('Bulletins failed'));
    vi.mocked(runNews).mockRejectedValue(new Error('News failed'));

    const result = await runDailyFull();

    expect(result.status).toBe('failed');
    expect(result.summary.totalSteps).toBe(5);
    expect(result.summary.successfulSteps).toBe(0);
    expect(result.summary.failedSteps).toBe(5);
    expect(result.errors).toHaveLength(5);
  });

  it('collects error details from each failed step', async () => {
    const { runBdfinInstruments } = await import('../../src/runners/runBdfinInstruments.js');
    const { runBdfinMarket } = await import('../../src/runners/runBdfinMarket.js');
    const { runCommuniques } = await import('../../src/runners/runCommuniques.js');
    const { runBulletins } = await import('../../src/runners/runBulletins.js');
    const { runNews } = await import('../../src/scrapers/runNews.js');

    vi.mocked(runBdfinInstruments).mockResolvedValue({ status: 'success', count: 48 });
    vi.mocked(runBdfinMarket).mockRejectedValue(new Error('Network timeout'));
    vi.mocked(runCommuniques).mockResolvedValue({ status: 'success', count: 10 });
    vi.mocked(runBulletins).mockResolvedValue({ status: 'success', count: 5 });
    vi.mocked(runNews).mockResolvedValue(undefined);

    const result = await runDailyFull();

    const marketError = result.errors.find((e) => e.step === 'bdfin_market');
    expect(marketError).toBeDefined();
    expect(marketError!.error).toContain('Network timeout');
  });

  it('accepts optional targetDate parameter', async () => {
    const { runBdfinInstruments } = await import('../../src/runners/runBdfinInstruments.js');
    const { runBdfinMarket } = await import('../../src/runners/runBdfinMarket.js');
    const { runCommuniques } = await import('../../src/runners/runCommuniques.js');
    const { runBulletins } = await import('../../src/runners/runBulletins.js');
    const { runNews } = await import('../../src/scrapers/runNews.js');

    vi.mocked(runBdfinInstruments).mockResolvedValue({ status: 'success', count: 48 });
    vi.mocked(runBdfinMarket).mockResolvedValue({ status: 'success', actions: 45, obligations: 15 });
    vi.mocked(runCommuniques).mockResolvedValue({ status: 'success', count: 10 });
    vi.mocked(runBulletins).mockResolvedValue({ status: 'success', count: 5 });
    vi.mocked(runNews).mockResolvedValue(undefined);

    const targetDate = '2025-06-10';
    const result = await runDailyFull(targetDate);

    expect(result.status).toBe('success');
    // Verify that runBdfinMarket was called with the targetDate
    expect(vi.mocked(runBdfinMarket)).toHaveBeenCalledWith(expect.any(Object), targetDate);
  });

  it('includes timestamps in result (startedAt and finishedAt)', async () => {
    const { runBdfinInstruments } = await import('../../src/runners/runBdfinInstruments.js');
    const { runBdfinMarket } = await import('../../src/runners/runBdfinMarket.js');
    const { runCommuniques } = await import('../../src/runners/runCommuniques.js');
    const { runBulletins } = await import('../../src/runners/runBulletins.js');
    const { runNews } = await import('../../src/scrapers/runNews.js');

    vi.mocked(runBdfinInstruments).mockResolvedValue({ status: 'success', count: 48 });
    vi.mocked(runBdfinMarket).mockResolvedValue({ status: 'success', actions: 45, obligations: 15 });
    vi.mocked(runCommuniques).mockResolvedValue({ status: 'success', count: 10 });
    vi.mocked(runBulletins).mockResolvedValue({ status: 'success', count: 5 });
    vi.mocked(runNews).mockResolvedValue(undefined);

    const before = new Date().toISOString();
    const result = await runDailyFull();
    const after = new Date().toISOString();

    expect(result.startedAt).toBeDefined();
    expect(result.finishedAt).toBeDefined();
    // Timestamps should be ISO 8601 strings
    expect(result.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // Verify order: started before finished
    expect(new Date(result.startedAt).getTime()).toBeLessThanOrEqual(
      new Date(result.finishedAt).getTime(),
    );
  });
});
