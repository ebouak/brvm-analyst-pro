'use client';

import {
  getPatternBadgeStyle,
  getPatternScoreColor,
} from '@/lib/patterns/advisor';

export interface PatternEnrichmentProps {
  pattern_delta: number;
  pattern_confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  pattern_explanation_fr: string;
  has_patterns: boolean;
}

/**
 * Display intraday pattern enrichment as a badge/panel
 * Shows pattern confidence, delta contribution, and explanation
 */
export default function PatternEnrichmentBadge({
  pattern_delta,
  pattern_confidence,
  pattern_explanation_fr,
  has_patterns,
}: PatternEnrichmentProps) {
  if (!has_patterns) {
    return null;
  }

  return (
    <div
      className={`border rounded-lg p-3 ${getPatternBadgeStyle(pattern_confidence)}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold">⚡ Motifs Intraday</span>
        <span
          className={`text-sm font-bold ${getPatternScoreColor(pattern_delta)}`}
        >
          {pattern_delta > 0 ? '+' : ''}
          {pattern_delta.toFixed(1)}
        </span>
      </div>
      <p className="text-xs leading-relaxed">{pattern_explanation_fr}</p>
      <div className="mt-2 text-xs opacity-75">
        Confiance:{' '}
        <span className="font-semibold">{pattern_confidence}</span>
      </div>
    </div>
  );
}
