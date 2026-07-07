/**
 * ATR (Average True Range) detection and calculation
 * Measures volatility using True Range (high-low, high-prevClose, low-prevClose gaps)
 */

/**
 * Candle structure for True Range calculation
 */
export interface TRCandle {
  high: number;
  low: number;
  close: number;
  prevClose: number;
}

/**
 * Calculate True Range for a single candle
 *
 * True Range = max(high-low, |high-prevClose|, |low-prevClose|)
 *
 * Captures three types of volatility:
 * - Regular range (high - low)
 * - Gap up (high - prevClose if positive)
 * - Gap down (prevClose - low if positive)
 *
 * @param candle - Candle with high, low, close, prevClose
 * @returns True Range value
 */
export function calculateTrueRange(candle: TRCandle): number {
  const highLow = candle.high - candle.low;
  const highPrevClose = Math.abs(candle.high - candle.prevClose);
  const lowPrevClose = Math.abs(candle.low - candle.prevClose);

  return Math.max(highLow, highPrevClose, lowPrevClose);
}

/**
 * Calculate Average True Range
 *
 * ATR = SMA(True Range, period)
 * Standard period is 14
 *
 * @param trueRanges - Array of True Range values
 * @param period - Period for simple moving average (default: 14)
 * @returns ATR value, or 0 if not enough data
 */
export function calculateATR(trueRanges: number[], period: number = 14): number {
  if (trueRanges.length < period) {
    return 0; // Not enough data for calculation
  }

  // Use only the most recent `period` values
  const recentTR = trueRanges.slice(-period);
  const sum = recentTR.reduce((acc, tr) => acc + tr, 0);
  return sum / period;
}

/**
 * Detect ATR extreme moves (volatility spikes)
 *
 * Extreme if: |close - prevClose| > ATR × multiplier
 *
 * Returns false if ATR is 0 (not enough data for reliable detection)
 *
 * @param close - Current close price
 * @param prevClose - Previous close price
 * @param atr - Current ATR value
 * @param multiplier - ATR multiplier threshold (default: 3.0)
 * @returns True if move is extreme
 */
export function detectATRExtreme(
  close: number,
  prevClose: number,
  atr: number,
  multiplier: number = 3.0,
): boolean {
  // Can't detect extremes without valid ATR
  if (atr === 0) {
    return false;
  }

  const changeAmount = Math.abs(close - prevClose);
  const threshold = atr * multiplier;
  return changeAmount > threshold;
}

/**
 * ATR extreme detection result
 */
export interface ATRExtremeResult {
  index: number;
  isExtreme: boolean;
  atr: number;
  changeAmount: number;
  tr?: number;
}

/**
 * Candle interface for batch detection
 */
export interface Candle {
  high: number;
  low: number;
  close: number;
}

/**
 * Batch detect ATR extremes across a candle series
 *
 * Iterates through candles, accumulates True Range values,
 * calculates ATR, and detects extremes at each step.
 *
 * @param candles - Array of candles (high, low, close)
 * @param atrPeriod - ATR calculation period (default: 14)
 * @param multiplier - Extreme detection multiplier (default: 3.0)
 * @returns Array of detection results with index, isExtreme, atr, changeAmount
 */
export function detectATRExtremes(
  candles: Candle[],
  atrPeriod: number = 14,
  multiplier: number = 3.0,
): ATRExtremeResult[] {
  const results: ATRExtremeResult[] = [];
  const trueRanges: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]!;
    const prevClose = i > 0 ? candles[i - 1]!.close : candle.close;

    // Calculate True Range for this candle
    const tr = calculateTrueRange({
      high: candle.high,
      low: candle.low,
      close: candle.close,
      prevClose,
    });

    trueRanges.push(tr);

    // Calculate ATR (may be 0 if not enough data)
    const atr = calculateATR(trueRanges, atrPeriod);

    // Calculate change amount
    const changeAmount = Math.abs(candle.close - prevClose);

    // Detect extreme
    const isExtreme = detectATRExtreme(candle.close, prevClose, atr, multiplier);

    results.push({
      index: i,
      isExtreme,
      atr,
      changeAmount,
      tr,
    });
  }

  return results;
}
