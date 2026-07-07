import { describe, it, expect } from 'vitest';
import {
  calculateTrueRange,
  calculateATR,
  detectATRExtreme,
  detectATRExtremes,
} from '../../../src/intraday/indicators/atr.js';

describe('ATR Detection', () => {
  describe('calculateTrueRange', () => {
    it('should calculate true range as max(high-low, |high-prevClose|, |low-prevClose|)', () => {
      const tr = calculateTrueRange({
        high: 105,
        low: 100,
        close: 102,
        prevClose: 103,
      });

      // TR = max(high-low, |high-prevClose|, |low-prevClose|)
      // TR = max(5, |105-103|, |100-103|) = max(5, 2, 3) = 5
      expect(tr).toBe(5);
    });

    it('should handle gap up scenario', () => {
      const tr = calculateTrueRange({
        high: 110,
        low: 108,
        close: 109,
        prevClose: 100,
      });

      // TR = max(2, |110-100|, |108-100|) = max(2, 10, 8) = 10
      expect(tr).toBe(10);
    });

    it('should handle gap down scenario', () => {
      const tr = calculateTrueRange({
        high: 92,
        low: 88,
        close: 90,
        prevClose: 100,
      });

      // TR = max(4, |92-100|, |88-100|) = max(4, 8, 12) = 12
      expect(tr).toBe(12);
    });
  });

  describe('calculateATR', () => {
    it('should calculate 14-period ATR as simple moving average of true ranges', () => {
      const trueRanges = [4, 5, 3, 6, 4, 5, 3, 7, 4, 5, 3, 5, 4, 6];
      const atr = calculateATR(trueRanges, 14);

      const expectedATR = (4 + 5 + 3 + 6 + 4 + 5 + 3 + 7 + 4 + 5 + 3 + 5 + 4 + 6) / 14;
      expect(atr).toBeCloseTo(expectedATR, 2);
    });

    it('should return 0 when not enough data', () => {
      const trueRanges = [4, 5, 3]; // Only 3 values, need 14
      const atr = calculateATR(trueRanges, 14);
      expect(atr).toBe(0);
    });

    it('should use custom period if provided', () => {
      const trueRanges = [4, 5, 3, 6, 4]; // 5 values
      const atr = calculateATR(trueRanges, 5);

      const expectedATR = (4 + 5 + 3 + 6 + 4) / 5;
      expect(atr).toBeCloseTo(expectedATR, 2);
    });
  });

  describe('detectATRExtreme', () => {
    it('should detect extreme move when change exceeds ATR × multiplier', () => {
      const close = 100;
      const prevClose = 92; // 8 points change
      const atr = 2.5;
      const multiplier = 3.0;
      // Threshold = 2.5 × 3.0 = 7.5, so 8 > 7.5 is extreme

      expect(detectATRExtreme(close, prevClose, atr, multiplier)).toBe(true);
    });

    it('should not detect extreme when change is below threshold', () => {
      const close = 100;
      const prevClose = 94; // 6 points change
      const atr = 2.5;
      const multiplier = 3.0;
      // Threshold = 7.5, so 6 < 7.5 is not extreme

      expect(detectATRExtreme(close, prevClose, atr, multiplier)).toBe(false);
    });

    it('should use default multiplier of 3.0 if not provided', () => {
      const close = 100;
      const prevClose = 92; // 8 points
      const atr = 2.5;
      // Default multiplier = 3.0, threshold = 7.5, so 8 > 7.5 is extreme

      expect(detectATRExtreme(close, prevClose, atr)).toBe(true);
    });

    it('should handle negative price changes symmetrically', () => {
      const close = 92;
      const prevClose = 100; // -8 points change
      const atr = 2.5;
      const multiplier = 3.0;
      // |92 - 100| = 8, threshold = 7.5, so extreme

      expect(detectATRExtreme(close, prevClose, atr, multiplier)).toBe(true);
    });

    it('should return false when ATR is 0 (not enough data)', () => {
      const close = 100;
      const prevClose = 80; // Large change
      const atr = 0; // No data
      const multiplier = 3.0;
      // Can't detect extremes with ATR = 0

      expect(detectATRExtreme(close, prevClose, atr, multiplier)).toBe(false);
    });
  });

  describe('detectATRExtremes', () => {
    it('should detect ATR extremes across a series of candles', () => {
      const candles = [
        { high: 100, low: 98, close: 99 },
        { high: 102, low: 99, close: 101 }, // Up 2 points, normal
        { high: 105, low: 100, close: 104 }, // Up 3 points, normal
        { high: 102, low: 95, close: 96 }, // Down 8 points (potential extreme)
        { high: 98, low: 95, close: 97 }, // Up 1 point
      ];

      const results = detectATRExtremes(candles, 14, 3.0);

      expect(results).toHaveLength(5);
      expect(results[0]).toMatchObject({ index: 0, isExtreme: false });
      expect(results[1]).toMatchObject({ index: 1, isExtreme: false });
      expect(results[2]).toMatchObject({ index: 2, isExtreme: false });
      // Result 3 depends on ATR calculation (first 3 TR values)
      expect(results[3]).toMatchObject({ index: 3 });
      expect(results[4]).toMatchObject({ index: 4 });
    });

    it('should accumulate true ranges correctly', () => {
      const candles = [
        { high: 100, low: 99, close: 100 },
        { high: 101, low: 100, close: 101 }, // TR = max(1, 1, 0) = 1
        { high: 102, low: 101, close: 102 }, // TR = max(1, 1, 0) = 1
      ];

      const results = detectATRExtremes(candles, 3, 2.0);

      expect(results[0]).toMatchObject({ index: 0, changeAmount: 0 });
      expect(results[1]).toMatchObject({ index: 1, changeAmount: 1, atr: 0 }); // Not enough data
      expect(results[2]).toMatchObject({ index: 2, changeAmount: 1, atr: 1 }); // ATR = (1+1+1)/3 = 1
    });
  });
});
