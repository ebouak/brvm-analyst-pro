import type { PatternScore } from '@/lib/patterns/database.js';

export interface AdvisorEnrichment {
  pattern_delta: number; // -5 to +5
  pattern_confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  pattern_explanation_fr: string;
  has_patterns: boolean;
}

/**
 * Enrich advisor score with intraday pattern signals
 * Safely handles null pattern scores and produces French explanations
 */
export function enrichAdvisorWithPatterns(
  baseAdvisorScore: number,
  patternScore: PatternScore | null
): AdvisorEnrichment {
  if (!patternScore) {
    return {
      pattern_delta: 0,
      pattern_confidence: 'LOW',
      pattern_explanation_fr: 'Aucun motif intraday détecté',
      has_patterns: false,
    };
  }

  const delta = patternScore.advisor_sub_score_delta || 0;
  const confidence = patternScore.overall_confidence || 'LOW';

  let explanation = '';

  // ATR volatility contribution
  if (patternScore.atr_score && patternScore.atr_score !== 0) {
    if (patternScore.atr_score > 0) {
      explanation += `Volatilité extrême détectée (+${patternScore.atr_score} ATR). `;
    } else {
      explanation += `Volatilité réduite (${patternScore.atr_score} ATR). `;
    }
  }

  // Consolidation pattern contribution
  if (patternScore.consolidation_score && patternScore.consolidation_score !== 0) {
    if (patternScore.consolidation_score > 0) {
      explanation += `Pattern haussier en consolidation. Signal positif court terme. `;
    } else {
      explanation += `Consolidation baissière. À surveiller. `;
    }
  }

  // Fallback if no specific explanation generated
  if (!explanation) {
    explanation = 'Motifs techniques détectés avec faible confiance.';
  }

  return {
    pattern_delta: delta,
    pattern_confidence: confidence as 'HIGH' | 'MEDIUM' | 'LOW',
    pattern_explanation_fr: explanation.trim(),
    has_patterns: (patternScore.patterns_detected_count || 0) > 0,
  };
}

/**
 * Get Tailwind style classes for pattern confidence badge
 */
export function getPatternBadgeStyle(
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
): string {
  const styles = {
    HIGH: 'bg-up/20 text-up border-up/40',
    MEDIUM: 'bg-warn/20 text-warn border-warn/40',
    LOW: 'bg-down/20 text-down border-down/40',
  };
  return styles[confidence];
}

/**
 * Get color class for pattern score display
 */
export function getPatternScoreColor(score: number): string {
  if (score > 1.5) return 'text-up'; // Strong positive
  if (score > 0) return 'text-emerald-400'; // Positive
  if (score < -1.5) return 'text-down'; // Strong negative
  if (score < 0) return 'text-orange-400'; // Negative
  return 'text-muted'; // Neutral
}

/**
 * Apply pattern delta to advisor score clamped to [-5, +5] range
 */
export function applyPatternDelta(
  baseScore: number,
  enrichment: AdvisorEnrichment
): number {
  return Math.max(-5, Math.min(5, baseScore + enrichment.pattern_delta));
}
