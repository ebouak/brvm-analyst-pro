import { describe, it, expect } from 'vitest';
import {
  calculateBodyRatio,
  detectConsolidation,
  isStairStepPattern,
  detectConsolidationPatterns,
} from '../../../src/intraday/indicators/consolidation.js';

describe('Consolidation Pattern Detection', () => {
  it('should calculate body ratio correctly', () => {
    const bodyRatio = calculateBodyRatio({
      open: 100,
      close: 103,
      high: 105,
      low: 100,
    });

    // Body = |close - open| = 3
    // Range = high - low = 5
    // Ratio = 3 / 5 = 0.6
    expect(bodyRatio).toBeCloseTo(0.6, 2);
  });

  it('should handle zero-range candles (doji-like)', () => {
    const bodyRatio = calculateBodyRatio({
      open: 100,
      close: 100,
      high: 100,
      low: 100,
    });
    // Range = 0, prevent division by zero
    expect(bodyRatio).toBe(0);
  });

  it('should detect tight bodies in consolidation', () => {
    const candles = [
      { open: 100, close: 101, high: 102, low: 100 }, // body ratio 0.5
      { open: 101, close: 102, high: 103, low: 101 }, // body ratio 0.5
      { open: 102, close: 103, high: 104, low: 102 }, // body ratio 0.5
    ];

    const consolidation = detectConsolidation(candles, 3, 0.6);
    expect(consolidation).toBe(true);
  });

  it('should detect stair-step pattern (higher lows, higher closes)', () => {
    const candles = [
      { open: 100, close: 101, high: 102, low: 100 },
      { open: 101, close: 102, high: 103, low: 101 }, // Higher low (101 > 100), higher close (102 > 101)
      { open: 102, close: 103, high: 104, low: 102 }, // Higher low (102 > 101), higher close (103 > 102)
    ];

    const isStairStep = isStairStepPattern(candles);
    expect(isStairStep).toBe(true);
  });

  it('should reject non-stair-step patterns (lower closes)', () => {
    const candles = [
      { open: 100, close: 101, high: 102, low: 100 },
      { open: 101, close: 100, high: 103, low: 99 }, // Lower close, breaks pattern
      { open: 100, close: 102, high: 104, low: 98 },
    ];

    const isStairStep = isStairStepPattern(candles);
    expect(isStairStep).toBe(false);
  });

  it('should reject patterns with non-ascending lows', () => {
    const candles = [
      { open: 100, close: 101, high: 102, low: 100 },
      { open: 101, close: 102, high: 103, low: 101 },
      { open: 102, close: 103, high: 104, low: 101 }, // Low doesn't increase (101 = 101)
    ];

    const isStairStep = isStairStepPattern(candles);
    expect(isStairStep).toBe(false);
  });

  it('should batch detect consolidations with confidence scores', () => {
    const candles = [
      { open: 100, close: 101, high: 102, low: 100 },
      { open: 101, close: 102, high: 103, low: 101 },
      { open: 102, close: 103, high: 104, low: 102 },
      { open: 103, close: 104, high: 105, low: 103 },
    ];

    const patterns = detectConsolidationPatterns(candles, 3, 0.6);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].confidence).toBeGreaterThan(0);
    expect(patterns[0].confidence).toBeLessThanOrEqual(1);
  });
});
