/**
 * Orchestration module for PHASE 3A/3B pattern detection pipeline
 * Combines ATR detection, consolidation detection, and qualification logic
 */

import { detectATRExtremes } from './indicators/atr.js';
import { detectConsolidationPatterns } from './indicators/consolidation.js';
import type { Candle15m } from './reconstruct.js';

export interface RawPattern {
  code: string;
  date_marche: string;
  pattern_type: 'atr_extreme' | 'bullish_consolidation';
  timeframe: '15m' | '30m';
  candle_start_time: Date;
  candle_end_time: Date;
  value: number;
  threshold: number;
  is_triggered: boolean;
  engine_version: string;
  rules_version: string;
}

export interface QualifiedPattern extends RawPattern {
  quality_score: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  validation_status: 'VALID' | 'QUESTIONABLE' | 'INVALID';
  explanation_fr: string;
}

/**
 * PHASE 3A: Run raw pattern detection (ATR + consolidation)
 *
 * Takes reconstructed 15-minute candles and applies two detection strategies:
 * 1. ATR Extreme: Detects volatility spikes using Average True Range
 * 2. Bullish Consolidation: Detects tight trading ranges (squeeze setups)
 *
 * @param candles - Array of reconstructed 15-minute candles
 * @param code - Instrument code (e.g., 'PALC')
 * @param dateMarche - Trading date in YYYY-MM-DD format
 * @param engineVersion - Engine version string (e.g., 'v1.0.0')
 * @param rulesVersion - Rules version (default: 'r1.0.0')
 * @returns Array of raw pattern detections
 */
export function runPhase3A(
  candles: Candle15m[],
  code: string,
  dateMarche: string,
  engineVersion: string,
  rulesVersion: string = 'r1.0.0',
): RawPattern[] {
  const patterns: RawPattern[] = [];

  if (candles.length === 0) {
    return patterns;
  }

  // === ATR Detection (PHASE 3A - Part 1) ===
  // Detect extreme volatility moves using Average True Range
  const atrResults = detectATRExtremes(
    candles.map((c) => ({ close: c.close, high: c.high, low: c.low })),
    14, // ATR period
    3.0, // Multiplier threshold
  );

  for (let i = 0; i < atrResults.length; i++) {
    const atrResult = atrResults[i];
    if (atrResult && atrResult.isExtreme) {
      const candle = candles[i];
      if (candle) {
        patterns.push({
          code,
          date_marche: dateMarche,
          pattern_type: 'atr_extreme',
          timeframe: '15m',
          candle_start_time: candle.time_start,
          candle_end_time: candle.time_end,
          value: atrResult.changeAmount,
          threshold: atrResult.atr * 3.0,
          is_triggered: true,
          engine_version: engineVersion,
          rules_version: rulesVersion,
        });
      }
    }
  }

  // === Consolidation Detection (PHASE 3A - Part 2) ===
  // Detect tight trading ranges (consolidation patterns)
  const consolidationPatterns = detectConsolidationPatterns(
    candles.map((c) => ({ open: c.open, close: c.close, high: c.high, low: c.low })),
    3, // Minimum bars
    0.3, // Max body ratio
  );

  for (const consPattern of consolidationPatterns) {
    const endIdx = consPattern.startIndex + consPattern.length - 1;
    const candle = candles[endIdx];
    if (candle && consPattern.confidence >= 0.5) {
      // Only include if confidence meets threshold
      patterns.push({
        code,
        date_marche: dateMarche,
        pattern_type: 'bullish_consolidation',
        timeframe: '15m',
        candle_start_time: candles[consPattern.startIndex]!.time_start,
        candle_end_time: candle.time_end,
        value: consPattern.confidence,
        threshold: 0.7, // Min confidence for valid consolidation
        is_triggered: consPattern.confidence >= 0.7,
        engine_version: engineVersion,
        rules_version: rulesVersion,
      });
    }
  }

  return patterns;
}

/**
 * PHASE 3B: Qualify patterns (apply confidence rules, validate)
 *
 * Takes raw patterns from PHASE 3A and applies qualification logic:
 * - Calculates quality score as (value / threshold)
 * - Assigns confidence level based on quality score
 * - Determines validation status based on confidence and trigger state
 * - Generates French-language explanation
 *
 * Confidence levels:
 * - HIGH: quality > 1.2 (pattern significantly exceeds threshold)
 * - MEDIUM: quality > 0.8 (pattern moderately exceeds threshold)
 * - LOW: quality <= 0.8 (pattern weakly signals)
 *
 * Validation status:
 * - VALID: HIGH confidence + triggered = strong signal
 * - QUESTIONABLE: MEDIUM confidence + triggered = moderate signal
 * - INVALID: anything else = weak or not triggered
 *
 * @param rawPatterns - Array of raw patterns from PHASE 3A
 * @param minQualityScore - Minimum quality score to qualify (default: 0.5)
 * @returns Array of qualified patterns with confidence levels and validation
 */
export function qualifyPatterns(
  rawPatterns: RawPattern[],
  minQualityScore: number = 0.5,
): QualifiedPattern[] {
  return rawPatterns.map((raw) => {
    // Calculate quality as ratio of value to threshold
    // Do NOT clamp for confidence calculation (value can exceed threshold)
    const rawQuality = raw.threshold > 0 ? raw.value / raw.threshold : 0;

    // Determine confidence level based on raw ratio (not clamped)
    let confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    if (rawQuality > 1.2) {
      confidenceLevel = 'HIGH';
    } else if (rawQuality > 0.8) {
      confidenceLevel = 'MEDIUM';
    } else {
      confidenceLevel = 'LOW';
    }

    // Quality score for storage: clamp to [0, 1] for database normalization
    const quality = Math.min(1.0, Math.max(0.0, rawQuality));

    // Determine validation status
    // Pattern is VALID if it has HIGH confidence AND is triggered
    // Pattern is QUESTIONABLE if it has MEDIUM confidence AND is triggered
    // Pattern is INVALID otherwise
    let validationStatus: 'VALID' | 'QUESTIONABLE' | 'INVALID';
    if (confidenceLevel === 'HIGH' && raw.is_triggered) {
      validationStatus = 'VALID';
    } else if (confidenceLevel === 'MEDIUM' && raw.is_triggered) {
      validationStatus = 'QUESTIONABLE';
    } else {
      validationStatus = 'INVALID';
    }

    // Generate French explanation
    const patternNameFr =
      raw.pattern_type === 'atr_extreme'
        ? 'Volatilité extrême (ATR)'
        : 'Consolidation haussière';

    const statusFr = {
      VALID: 'Signal valide',
      QUESTIONABLE: 'Signal modéré',
      INVALID: 'Signal faible',
    }[validationStatus];

    const explanation_fr = `${patternNameFr}: ${statusFr} (confiance: ${confidenceLevel})`;

    return {
      ...raw,
      quality_score: quality,
      confidence_level: confidenceLevel,
      validation_status: validationStatus,
      explanation_fr,
    };
  });
}
