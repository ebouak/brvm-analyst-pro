/**
 * Consolidation Pattern Detection
 *
 * Identifies bullish consolidation (stair-step) patterns in OHLC candle data.
 * Features tight bodies (small percentage of range) and ascending structure
 * (higher lows, higher closes).
 *
 * @module intraday/indicators/consolidation
 */

export interface Candle {
  open: number;
  close: number;
  high: number;
  low: number;
}

/**
 * Calculate body-to-range ratio (indication of consolidation tightness)
 *
 * Body = |close - open|
 * Range = high - low
 * Ratio = Body / Range
 *
 * A lower ratio indicates a tighter body (more consolidation)
 *
 * @param candle OHLC candle data
 * @returns Body-to-range ratio (0.0 to 1.0)
 *
 * @example
 * ```typescript
 * const ratio = calculateBodyRatio({
 *   open: 100, close: 103, high: 105, low: 100
 * });
 * // ratio = 3 / 5 = 0.6
 * ```
 */
export function calculateBodyRatio(candle: Candle): number {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;

  if (range === 0) return 0; // Prevent division by zero (doji-like candle)
  return body / range;
}

/**
 * Detect if candles form a stair-step pattern
 *
 * Bullish consolidation requires:
 * - Each candle's low > previous low (ascending lows)
 * - Each candle's close > previous close (ascending closes)
 *
 * @param candles Array of OHLC candles
 * @returns true if pattern matches stair-step, false otherwise
 *
 * @example
 * ```typescript
 * const candles = [
 *   { open: 100, close: 101, high: 102, low: 100 },
 *   { open: 101, close: 102, high: 103, low: 101 }, // low 101 > 100, close 102 > 101
 *   { open: 102, close: 103, high: 104, low: 102 }, // low 102 > 101, close 103 > 102
 * ];
 * isStairStepPattern(candles); // true
 * ```
 */
export function isStairStepPattern(candles: Candle[]): boolean {
  if (candles.length < 2) return false;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]!;
    const curr = candles[i]!;

    // Break pattern if current low ≤ previous low OR current close ≤ previous close
    if (curr.low <= prev.low || curr.close <= prev.close) {
      return false;
    }
  }

  return true;
}

/**
 * Detect consolidation pattern in a series of candles
 *
 * A valid consolidation pattern requires:
 * 1. Minimum number of consecutive candles (typically 3+)
 * 2. Tight bodies (body ratio ≤ maxBodyRatio)
 * 3. Stair-step structure (higher lows, higher closes)
 *
 * @param candles Array of OHLC candles
 * @param minBars Minimum consecutive bars for pattern (default: 3)
 * @param maxBodyRatio Maximum body-to-range ratio for tight bodies (default: 0.3)
 * @returns true if consolidation pattern detected, false otherwise
 *
 * @example
 * ```typescript
 * const tightCandles = [
 *   { open: 100, close: 101, high: 102, low: 100 },
 *   { open: 101, close: 102, high: 103, low: 101 },
 *   { open: 102, close: 103, high: 104, low: 102 },
 * ];
 * detectConsolidation(tightCandles, 3, 0.5); // true
 * ```
 */
export function detectConsolidation(
  candles: Candle[],
  minBars: number = 3,
  maxBodyRatio: number = 0.3
): boolean {
  if (candles.length < minBars) return false;

  // Check if all candles have tight bodies
  const tightBodies = candles.every((c) => calculateBodyRatio(c) <= maxBodyRatio);
  if (!tightBodies) return false;

  // Check if candles form stair-step pattern
  return isStairStepPattern(candles);
}

/**
 * Consolidation pattern detection result
 */
export interface ConsolidationPattern {
  startIndex: number;
  length: number;
  confidence: number;
  avgBodyRatio: number;
}

/**
 * Batch detect consolidations across a series of candles
 *
 * Scans the entire candle array for consolidation patterns using a sliding window.
 * Returns all detected patterns with confidence scores.
 *
 * Confidence calculation:
 * - Based on tightness (lower body ratio = higher confidence)
 * - Scaled to 0.1-1.0 range
 *
 * @param candles Array of OHLC candles
 * @param minBars Minimum consecutive bars for pattern (default: 3)
 * @param maxBodyRatio Maximum body-to-range ratio for tight bodies (default: 0.3)
 * @returns Array of detected consolidation patterns with metadata
 *
 * @example
 * ```typescript
 * const candles = [
 *   { open: 100, close: 101, high: 102, low: 100 },
 *   { open: 101, close: 102, high: 103, low: 101 },
 *   { open: 102, close: 103, high: 104, low: 102 },
 *   { open: 103, close: 104, high: 105, low: 103 },
 * ];
 * const patterns = detectConsolidationPatterns(candles, 3, 0.5);
 * // Returns patterns with start index, length, and confidence
 * ```
 */
export function detectConsolidationPatterns(
  candles: Candle[],
  minBars: number = 3,
  maxBodyRatio: number = 0.3
): ConsolidationPattern[] {
  const patterns: ConsolidationPattern[] = [];

  for (let i = 0; i <= candles.length - minBars; i++) {
    const window = candles.slice(i, i + minBars);

    if (detectConsolidation(window, minBars, maxBodyRatio)) {
      const avgBodyRatio =
        window.reduce((sum, c) => sum + calculateBodyRatio(c), 0) / window.length;

      // Tightness = inverse of body ratio (lower ratio = higher tightness)
      // Scale to 0.1-1.0 range to avoid over-confidence
      const tightness = 1 - avgBodyRatio;
      const confidence = Math.min(1.0, tightness * 0.9 + 0.1);

      patterns.push({
        startIndex: i,
        length: minBars,
        confidence,
        avgBodyRatio,
      });
    }
  }

  return patterns;
}
