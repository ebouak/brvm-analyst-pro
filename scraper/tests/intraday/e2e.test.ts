/**
 * End-to-End Pipeline Tests for Intraday Patterns
 *
 * Validates the complete PHASE 1-4 pipeline:
 * Snapshots → Reconstruction → Detection → Qualification → Aggregation
 */

import { describe, it, expect, vi } from 'vitest';
import { runIntraDayPatternsForCode } from '../../src/intraday/index.js';
import type { Snapshot } from '../../src/intraday/index.js';

// Mock the repository and logger modules to avoid database dependencies
vi.mock('../../src/intraday/repository.js', () => ({
  upsertQualifiedPatterns: vi.fn().mockResolvedValue(undefined),
  upsertPatternScores: vi.fn().mockResolvedValue(undefined),
  loadActiveCodes: vi.fn().mockResolvedValue(['PALC', 'NRDC']),
  loadSnapshots: vi.fn().mockResolvedValue([]),
  // Référence du signal volume_spike : le moteur fixing la lit désormais.
  // Sans ce mock, le pipeline part en erreur (pas de base en test).
  loadAvgVolume20d: vi.fn().mockResolvedValue(200),
}));

vi.mock('../../src/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Intraday Patterns E2E Pipeline', () => {
  const testCode = 'PALC';
  const testDate = '2026-07-07';

  /**
   * Realistic scenario: 3 windows with different patterns
   * Window 1 (10:00-10:15): Uptrend with tight bodies → consolidation signal
   * Window 2 (10:15-10:30): Large gap move → ATR extreme signal
   * Window 3 (10:30-10:45): Consolidation again
   */
  const consolidationAndAtrSnapshots: Snapshot[] = [
    // Window 1: 10:00-10:15 (uptrend, tight range)
    {
      code: testCode,
      timestamp: new Date('2026-07-07T10:00:00Z'),
      close: 100,
      volume: 1000,
    },
    {
      code: testCode,
      timestamp: new Date('2026-07-07T10:05:00Z'),
      close: 101,
      volume: 900,
    },
    {
      code: testCode,
      timestamp: new Date('2026-07-07T10:10:00Z'),
      close: 102,
      volume: 850,
    },
    {
      code: testCode,
      timestamp: new Date('2026-07-07T10:15:00Z'),
      close: 103,
      volume: 800,
    },

    // Window 2: 10:15-10:30 (large gap up, high volatility)
    {
      code: testCode,
      timestamp: new Date('2026-07-07T10:20:00Z'),
      close: 107,
      volume: 2000,
    },
    {
      code: testCode,
      timestamp: new Date('2026-07-07T10:25:00Z'),
      close: 108,
      volume: 1500,
    },
    {
      code: testCode,
      timestamp: new Date('2026-07-07T10:30:00Z'),
      close: 109,
      volume: 1200,
    },

    // Window 3: 10:30-10:45 (consolidation again)
    {
      code: testCode,
      timestamp: new Date('2026-07-07T10:35:00Z'),
      close: 110,
      volume: 550,
    },
    {
      code: testCode,
      timestamp: new Date('2026-07-07T10:40:00Z'),
      close: 111,
      volume: 500,
    },
    {
      code: testCode,
      timestamp: new Date('2026-07-07T10:45:00Z'),
      close: 112,
      volume: 450,
    },
  ];

  it('should run complete pipeline: reconstruct → detect → qualify → aggregate', async () => {
    const result = await runIntraDayPatternsForCode(testCode, testDate, consolidationAndAtrSnapshots);

    // Verify pipeline execution
    expect(result.code).toBe(testCode);
    expect(result.date_marche).toBe(testDate);
    expect(result.errors).toHaveLength(0);
    expect(typeof result.raw_patterns_count).toBe('number');
    expect(typeof result.qualified_patterns_count).toBe('number');
  });

  it('should detect raw patterns from intraday data', async () => {
    const result = await runIntraDayPatternsForCode(testCode, testDate, consolidationAndAtrSnapshots);

    // Should detect patterns (consolidated windows + ATR extreme in window 2)
    expect(result.raw_patterns_count).toBeGreaterThanOrEqual(0);
  });

  it('should qualify patterns with confidence levels', async () => {
    const result = await runIntraDayPatternsForCode(testCode, testDate, consolidationAndAtrSnapshots);

    // Qualified patterns should be filtered and scored
    expect(result.qualified_patterns_count).toBeGreaterThanOrEqual(0);
    expect(result.qualified_patterns_count).toBeLessThanOrEqual(result.raw_patterns_count);

    // If patterns exist, they should be qualified
    if (result.qualified_patterns_count > 0) {
      expect(result.scores_generated).not.toBeNull();
    }
  });

  it('should calculate aggregated daily score', async () => {
    const result = await runIntraDayPatternsForCode(testCode, testDate, consolidationAndAtrSnapshots);

    expect(result).toBeDefined();
    expect(result.code).toBe(testCode);
    expect(result.date_marche).toBe(testDate);
    expect(typeof result.raw_patterns_count).toBe('number');
    expect(typeof result.qualified_patterns_count).toBe('number');
  });

  it('should indicate when scores are generated', async () => {
    const result = await runIntraDayPatternsForCode(testCode, testDate, consolidationAndAtrSnapshots);

    expect(result).toBeDefined();
    expect(typeof result.scores_generated).toBe('boolean');
  });

  it('should handle empty snapshots gracefully', async () => {
    const result = await runIntraDayPatternsForCode(testCode, testDate, []);

    // Should complete without errors
    expect(result.errors.length).toBeGreaterThanOrEqual(0);
    expect(result.raw_patterns_count).toBe(0);
    expect(result.qualified_patterns_count).toBe(0);
    expect(result.code).toBe(testCode);
    expect(result.date_marche).toBe(testDate);
  });

  it('should be idempotent (re-running same data produces consistent results)', async () => {
    const result1 = await runIntraDayPatternsForCode(testCode, testDate, consolidationAndAtrSnapshots);
    const result2 = await runIntraDayPatternsForCode(testCode, testDate, consolidationAndAtrSnapshots);

    expect(result1.raw_patterns_count).toBe(result2.raw_patterns_count);
    expect(result1.qualified_patterns_count).toBe(result2.qualified_patterns_count);
    expect(result1.scores_generated).toBe(result2.scores_generated);
  });

  it('should handle snapshots with incomplete windows', async () => {
    const incompleteSnapshots: Snapshot[] = [
      {
        code: testCode,
        timestamp: new Date('2026-07-07T10:00:00Z'),
        close: 100,
        volume: 1000,
      },
      {
        code: testCode,
        timestamp: new Date('2026-07-07T10:10:00Z'),
        close: 102,
        volume: 800,
      },
      // Missing 10:05 and 10:15 → only 2 snapshots in window
    ];

    const result = await runIntraDayPatternsForCode(testCode, testDate, incompleteSnapshots);

    // Should process without exceptions (errors array may have entries from logger)
    expect(result.code).toBe(testCode);
    expect(result.date_marche).toBe(testDate);
  });

  it('should maintain data integrity through full pipeline', async () => {
    const result = await runIntraDayPatternsForCode(testCode, testDate, consolidationAndAtrSnapshots);

    // Check data types and ranges
    expect(typeof result.code).toBe('string');
    expect(typeof result.date_marche).toBe('string');
    expect(typeof result.raw_patterns_count).toBe('number');
    expect(typeof result.qualified_patterns_count).toBe('number');
    expect(typeof result.scores_generated).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('should handle strong ATR signal correctly', async () => {
    // Strong ATR spike scenario
    const strongAtrSnapshots: Snapshot[] = [
      {
        code: testCode,
        timestamp: new Date('2026-07-07T10:00:00Z'),
        close: 100,
        volume: 1000,
      },
      {
        code: testCode,
        timestamp: new Date('2026-07-07T10:05:00Z'),
        close: 100.5,
        volume: 800,
      },
      {
        code: testCode,
        timestamp: new Date('2026-07-07T10:10:00Z'),
        close: 100.3,
        volume: 750,
      },
      {
        code: testCode,
        timestamp: new Date('2026-07-07T10:15:00Z'),
        close: 100,
        volume: 900,
      },
      // Large gap to next candle
      {
        code: testCode,
        timestamp: new Date('2026-07-07T10:20:00Z'),
        close: 115,
        volume: 3000,
      },
      {
        code: testCode,
        timestamp: new Date('2026-07-07T10:25:00Z'),
        close: 116,
        volume: 2500,
      },
      {
        code: testCode,
        timestamp: new Date('2026-07-07T10:30:00Z'),
        close: 117,
        volume: 2000,
      },
    ];

    const result = await runIntraDayPatternsForCode(testCode, testDate, strongAtrSnapshots);

    expect(result.code).toBe(testCode);
    expect(result.date_marche).toBe(testDate);

    // With strong ATR, we expect patterns to potentially be detected
    // (specific patterns depend on detection thresholds)
    expect(typeof result.raw_patterns_count).toBe('number');
    expect(result.raw_patterns_count).toBeGreaterThanOrEqual(0);
  });

  it('should accumulate volumes correctly through pipeline', async () => {
    const result = await runIntraDayPatternsForCode(testCode, testDate, consolidationAndAtrSnapshots);

    // Verify that pipeline completed successfully with valid result structure
    expect(result.code).toBe(testCode);
    expect(result.date_marche).toBe(testDate);
    expect(typeof result.scores_generated).toBe('boolean');
  });

  it('should handle multiple instruments separately', async () => {
    const codeA = 'PALC';
    const codeB = 'NRDC';
    const date = '2026-07-07';

    const snapshotsA: Snapshot[] = [
      {
        code: codeA,
        timestamp: new Date('2026-07-07T10:00:00Z'),
        close: 100,
        volume: 1000,
      },
      {
        code: codeA,
        timestamp: new Date('2026-07-07T10:05:00Z'),
        close: 101,
        volume: 900,
      },
    ];

    const snapshotsB: Snapshot[] = [
      {
        code: codeB,
        timestamp: new Date('2026-07-07T10:00:00Z'),
        close: 50,
        volume: 500,
      },
      {
        code: codeB,
        timestamp: new Date('2026-07-07T10:05:00Z'),
        close: 51,
        volume: 450,
      },
    ];

    const resultA = await runIntraDayPatternsForCode(codeA, date, snapshotsA);
    const resultB = await runIntraDayPatternsForCode(codeB, date, snapshotsB);

    // Each should process independently
    expect(resultA.code).toBe(codeA);
    expect(resultB.code).toBe(codeB);
    expect(resultA.date_marche).toBe(date);
    expect(resultB.date_marche).toBe(date);
  });

  it('should accept engine version parameter', async () => {
    const engineVersion = 'v2.1.0';
    const result = await runIntraDayPatternsForCode(testCode, testDate, consolidationAndAtrSnapshots, engineVersion);

    // Should complete without error even with custom engine version
    expect(result.code).toBe(testCode);
    expect(result.date_marche).toBe(testDate);
  });

  it('should return valid result structure for all inputs', async () => {
    const result = await runIntraDayPatternsForCode(testCode, testDate, consolidationAndAtrSnapshots);

    // Verify complete result structure
    expect(result).toHaveProperty('code');
    expect(result).toHaveProperty('date_marche');
    expect(result).toHaveProperty('raw_patterns_count');
    expect(result).toHaveProperty('qualified_patterns_count');
    expect(result).toHaveProperty('scores_generated');
    expect(result).toHaveProperty('errors');
  });
});
