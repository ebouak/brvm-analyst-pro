import { describe, it, expect } from 'vitest';
import { runPhase3A, qualifyPatterns } from '../../src/intraday/orchestrate.js';
import type { Candle15m } from '../../src/intraday/reconstruct.js';

describe('Pattern Detection Orchestration', () => {
  it('should run PHASE 3A detection (ATR + consolidation)', () => {
    const candles: Candle15m[] = [
      {
        code: 'PALC',
        date_marche: '2026-07-07',
        time_start: new Date('2026-07-07T10:00:00Z'),
        time_end: new Date('2026-07-07T10:15:00Z'),
        open: 100,
        high: 105,
        low: 100,
        close: 103,
        volume: 5000,
        sample_count: 4,
        quality_score: 1.0,
        is_complete: true,
        is_synthetic: true,
        source: 'brvm_public_snapshot',
        engine_version: 'v1.0.0',
      },
      {
        code: 'PALC',
        date_marche: '2026-07-07',
        time_start: new Date('2026-07-07T10:15:00Z'),
        time_end: new Date('2026-07-07T10:30:00Z'),
        open: 103,
        high: 106,
        low: 102,
        close: 104,
        volume: 4000,
        sample_count: 4,
        quality_score: 1.0,
        is_complete: true,
        is_synthetic: true,
        source: 'brvm_public_snapshot',
        engine_version: 'v1.0.0',
      },
      {
        code: 'PALC',
        date_marche: '2026-07-07',
        time_start: new Date('2026-07-07T10:30:00Z'),
        time_end: new Date('2026-07-07T10:45:00Z'),
        open: 104,
        high: 107,
        low: 103,
        close: 105,
        volume: 3500,
        sample_count: 4,
        quality_score: 1.0,
        is_complete: true,
        is_synthetic: true,
        source: 'brvm_public_snapshot',
        engine_version: 'v1.0.0',
      },
    ];

    const rawDetections = runPhase3A(candles, 'PALC', '2026-07-07', 'v1.0.0');

    expect(rawDetections).toBeDefined();
    expect(Array.isArray(rawDetections)).toBe(true);
    expect(rawDetections.length).toBeGreaterThanOrEqual(0);
    // Should have pattern_type in atr_extreme or bullish_consolidation
    for (const pattern of rawDetections) {
      expect(pattern.code).toBe('PALC');
      expect(pattern.date_marche).toBe('2026-07-07');
      expect(['atr_extreme', 'bullish_consolidation']).toContain(pattern.pattern_type);
      expect(pattern.timeframe).toBe('15m');
      expect(pattern.is_triggered).toBeDefined();
      expect(pattern.engine_version).toBe('v1.0.0');
    }
  });

  it('should qualify patterns with confidence rules', () => {
    const rawPatterns = [
      {
        code: 'PALC',
        date_marche: '2026-07-07',
        pattern_type: 'atr_extreme' as const,
        timeframe: '15m' as const,
        candle_start_time: new Date('2026-07-07T10:00:00Z'),
        candle_end_time: new Date('2026-07-07T10:15:00Z'),
        value: 3.5,
        threshold: 2.0,
        is_triggered: true,
        engine_version: 'v1.0.0',
        rules_version: 'r1.0.0',
      },
    ];

    const qualified = qualifyPatterns(rawPatterns, 0.5);

    expect(qualified).toBeDefined();
    expect(Array.isArray(qualified)).toBe(true);
    expect(qualified.length).toBe(1);

    const pattern = qualified[0];
    expect(pattern.validation_status).toMatch(/VALID|QUESTIONABLE|INVALID/);
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(pattern.confidence_level);
    expect(pattern.quality_score).toBeGreaterThanOrEqual(0);
    expect(pattern.quality_score).toBeLessThanOrEqual(1);
    // HIGH confidence + quality 1.75 (3.5/2.0) = should be VALID
    expect(pattern.validation_status).toBe('VALID');
    expect(pattern.confidence_level).toBe('HIGH');
  });

  it('should handle low quality patterns correctly', () => {
    const rawPatterns = [
      {
        code: 'PALC',
        date_marche: '2026-07-07',
        pattern_type: 'bullish_consolidation' as const,
        timeframe: '15m' as const,
        candle_start_time: new Date('2026-07-07T10:00:00Z'),
        candle_end_time: new Date('2026-07-07T10:15:00Z'),
        value: 0.75,
        threshold: 1.0,
        is_triggered: false,
        engine_version: 'v1.0.0',
        rules_version: 'r1.0.0',
      },
    ];

    const qualified = qualifyPatterns(rawPatterns, 0.5);

    expect(qualified.length).toBe(1);
    const pattern = qualified[0];
    expect(pattern.validation_status).toBe('INVALID');
    expect(pattern.confidence_level).toBe('LOW');
  });
});
