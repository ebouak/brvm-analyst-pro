/**
 * Conseiller — Unified recommendation system
 *
 * Integrates the base advisor recommendation engine (lib/advisor/recommend.ts)
 * with intraday pattern signal enrichment. Produces a final recommendation
 * with pattern-adjusted scores and confidence.
 */

import type { AdvisorResult, AdvisorInputs, Action } from '@/lib/advisor/recommend.js';
import { recommend } from '@/lib/advisor/recommend.js';
import type { PatternScore } from '@/lib/patterns/database.js';
import {
  enrichAdvisorWithPatterns,
  applyPatternDelta,
} from '@/lib/patterns/advisor.js';

export interface EnrichedAdvisorResult extends AdvisorResult {
  patternEnrichment: {
    pattern_delta: number;
    pattern_confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    pattern_explanation_fr: string;
    has_patterns: boolean;
  };
  finalScore: number; // Score after pattern adjustment
}

/**
 * Generate a recommendation enriched with intraday pattern signals
 *
 * @param inputs Base advisor inputs (signal, confiance, dcfUpside, rsi, dividendYield)
 * @param patternScore Optional pattern score data for enrichment
 * @returns Enriched advisor result with pattern contribution and adjusted score
 */
export function recommendWithPatterns(
  inputs: AdvisorInputs,
  patternScore: PatternScore | null = null
): EnrichedAdvisorResult {
  // 1. Get base advisor recommendation
  const baseResult = recommend(inputs);

  // 2. Enrich with pattern signals
  const patternEnrichment = enrichAdvisorWithPatterns(baseResult.score, patternScore);

  // 3. Apply pattern delta to base score
  const finalScore = applyPatternDelta(baseResult.score, patternEnrichment);

  // 4. Recalculate conviction based on adjusted score
  const finalConviction = Math.min(100, Math.round(Math.abs(finalScore) * 1.6));

  // 5. Recompute action based on final score if it changed significantly
  const BUY_THRESHOLD = 22;
  const SELL_THRESHOLD = -22;
  const finalAction: Action =
    finalScore >= BUY_THRESHOLD
      ? 'acheter'
      : finalScore <= SELL_THRESHOLD
        ? 'vendre'
        : 'conserver';

  return {
    ...baseResult,
    action: finalAction,
    score: Math.round(finalScore),
    conviction: finalConviction,
    patternEnrichment,
    finalScore: Math.round(finalScore),
  };
}
