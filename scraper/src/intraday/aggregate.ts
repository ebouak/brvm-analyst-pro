/**
 * PHASE 4: Pattern Aggregation & Advisor Scoring
 *
 * Aggregates qualified patterns into daily scores and calculates advisor deltas
 * for integration with the Conseiller advisor system.
 *
 * Score ranges: -5 to +5 (per scoring guidelines)
 * Confidence: HIGH/MEDIUM/LOW
 * Advisor integration: sub_score_delta for enrichAdvisorRecommendation()
 */

import type { QualifiedPattern } from './orchestrate.js';

export interface PatternScore {
  code: string;
  date_marche: string;
  atr_score: number | null;
  atr_confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  consolidation_score: number | null;
  consolidation_confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  overall_confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  combined_pattern_score: number;
  patterns_detected_count: number;
  advisor_sub_score_delta: number;
  engine_version: string;
}

/**
 * Map confidence level to score in -5 to +5 range
 * HIGH = +4 (strong signal)
 * MEDIUM = +2 (moderate signal)
 * LOW = 0 (no signal)
 *
 * Score is scaled by quality (0-1) to reflect pattern strength
 *
 * @param confidence - Confidence level from qualification
 * @param quality - Quality score (0-1) from qualification
 * @returns Score in -5 to +5 range
 */
function confidenceToScore(confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null, quality: number): number {
  if (!confidence) return 0;

  const baseScore = confidence === 'HIGH' ? 4 : confidence === 'MEDIUM' ? 2 : 0;
  return Math.round(baseScore * quality);
}

/**
 * PHASE 4: Aggregate qualified patterns into daily score
 *
 * Groups patterns by type (ATR vs consolidation), calculates sub-scores,
 * derives overall confidence, and computes advisor delta for Conseiller.
 *
 * @param patterns - Array of qualified patterns (from PHASE 3B)
 * @param code - Instrument code (e.g., 'PALC')
 * @param dateMarche - Trading date (YYYY-MM-DD)
 * @param engineVersion - Engine version string (e.g., 'v1.0.0')
 * @returns PatternScore with aggregated results
 */
export function aggregatePatterns(
  patterns: QualifiedPattern[],
  code: string,
  dateMarche: string,
  engineVersion: string,
): PatternScore {
  // Filter by pattern type and validation status
  // Include VALID and QUESTIONABLE patterns (both represent signals)
  const atrPatterns = patterns.filter(
    (p) => p.pattern_type === 'atr_extreme' && (p.validation_status === 'VALID' || p.validation_status === 'QUESTIONABLE'),
  );
  const consolidationPatterns = patterns.filter(
    (p) => p.pattern_type === 'bullish_consolidation' && (p.validation_status === 'VALID' || p.validation_status === 'QUESTIONABLE'),
  );

  // === ATR Scoring ===
  let atrScore: number | null = null;
  let atrConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | null = null;

  if (atrPatterns.length > 0) {
    // Take best ATR pattern (highest quality)
    const bestATR = atrPatterns.reduce((best, current) => {
      return (current.quality_score || 0) > (best.quality_score || 0) ? current : best;
    });

    atrConfidence = bestATR.confidence_level;
    atrScore = confidenceToScore(atrConfidence, bestATR.quality_score || 0.5);
  }

  // === Consolidation Scoring ===
  let consolidationScore: number | null = null;
  let consolidationConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | null = null;

  if (consolidationPatterns.length > 0) {
    // Take best consolidation pattern (highest quality)
    const bestCons = consolidationPatterns.reduce((best, current) => {
      return (current.quality_score || 0) > (best.quality_score || 0) ? current : best;
    });

    consolidationConfidence = bestCons.confidence_level;
    consolidationScore = confidenceToScore(consolidationConfidence, bestCons.quality_score || 0.5);
  }

  // === Overall Confidence ===
  // Derived from strongest signal across all patterns
  const confidences: Array<'HIGH' | 'MEDIUM' | 'LOW'> = [];
  if (atrConfidence) confidences.push(atrConfidence);
  if (consolidationConfidence) confidences.push(consolidationConfidence);

  let overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (confidences.some((c) => c === 'HIGH')) {
    overallConfidence = 'HIGH';
  } else if (confidences.some((c) => c === 'MEDIUM')) {
    overallConfidence = 'MEDIUM';
  }

  // === Combined Score ===
  // Average of non-null sub-scores
  const scores = [atrScore, consolidationScore].filter((s) => s !== null);
  const combinedScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  // === Advisor Delta ===
  const advisorDelta = calculateAdvisorDelta({
    atr_confidence: atrConfidence,
    consolidation_confidence: consolidationConfidence,
    overall_confidence: overallConfidence,
  });

  return {
    code,
    date_marche: dateMarche,
    atr_score: atrScore,
    atr_confidence: atrConfidence,
    consolidation_score: consolidationScore,
    consolidation_confidence: consolidationConfidence,
    overall_confidence: overallConfidence,
    combined_pattern_score: combinedScore,
    patterns_detected_count: patterns.length,
    advisor_sub_score_delta: advisorDelta,
    engine_version: engineVersion,
  };
}

/**
 * Calculate advisor sub-score delta (-5 to +5 adjustment to Conseiller)
 *
 * Integration point with enrichAdvisorRecommendation() function.
 * Delta reflects pattern signal strength and agreement between indicators.
 *
 * Rules:
 * 1. Base delta from overall confidence
 *    - HIGH: +4 (strong signal)
 *    - MEDIUM: +2 (moderate signal)
 *    - LOW: 0 (no signal)
 *
 * 2. Bonus if patterns agree (+1)
 *    - Both HIGH, or both MEDIUM, or both LOW
 *
 * 3. Penalty if patterns conflict (-1)
 *    - One HIGH, other LOW (contradictory signals)
 *
 * @param input - Confidence levels from aggregation
 * @returns Delta in -5 to +5 range
 */
export function calculateAdvisorDelta(input: {
  atr_confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  consolidation_confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  overall_confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}): number {
  const { atr_confidence, consolidation_confidence, overall_confidence } = input;

  // === Base delta from overall confidence ===
  let delta = 0;
  if (overall_confidence === 'HIGH') {
    delta = 4;
  } else if (overall_confidence === 'MEDIUM') {
    delta = 2;
  } else {
    delta = 0;
  }

  // === Agreement bonus ===
  // If both patterns exist and have same confidence level, add bonus
  if (atr_confidence && consolidation_confidence && atr_confidence === consolidation_confidence) {
    delta = Math.min(5, delta + 1);
  }

  // === Conflict penalty ===
  // If one HIGH and other LOW, they contradict each other
  if (
    (atr_confidence === 'HIGH' && consolidation_confidence === 'LOW') ||
    (atr_confidence === 'LOW' && consolidation_confidence === 'HIGH')
  ) {
    delta = Math.max(-5, delta - 1);
  }

  return delta;
}
