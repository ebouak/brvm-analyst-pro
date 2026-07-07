import { describe, it, expect } from 'vitest';
import { aggregatePatterns, calculateAdvisorDelta } from '../../src/intraday/aggregate.js';
import type { QualifiedPattern } from '../../src/intraday/orchestrate.js';

describe('PHASE 4: Pattern Aggregation & Advisor Scoring', () => {
  it('should aggregate qualified patterns into daily score', () => {
    const patterns: QualifiedPattern[] = [
      {
        code: 'PALC',
        date_marche: '2026-07-07',
        pattern_type: 'atr_extreme',
        timeframe: '15m',
        candle_start_time: new Date('2026-07-07T10:00:00Z'),
        candle_end_time: new Date('2026-07-07T10:15:00Z'),
        value: 3.5,
        threshold: 2.0,
        is_triggered: true,
        engine_version: 'v1.0.0',
        rules_version: 'r1.0.0',
        quality_score: 0.95,
        confidence_level: 'HIGH',
        validation_status: 'VALID',
        explanation_fr: 'Volatilité extrême (ATR): Signal valide (confiance: HIGH)',
      },
      {
        code: 'PALC',
        date_marche: '2026-07-07',
        pattern_type: 'bullish_consolidation',
        timeframe: '15m',
        candle_start_time: new Date('2026-07-07T10:15:00Z'),
        candle_end_time: new Date('2026-07-07T10:30:00Z'),
        value: 0.8,
        threshold: 1.0,
        is_triggered: true,
        engine_version: 'v1.0.0',
        rules_version: 'r1.0.0',
        quality_score: 0.8,
        confidence_level: 'MEDIUM',
        validation_status: 'QUESTIONABLE',
        explanation_fr: 'Consolidation haussière: Signal modéré (confiance: MEDIUM)',
      },
    ];

    const score = aggregatePatterns(patterns, 'PALC', '2026-07-07', 'v1.0.0');

    expect(score).toBeDefined();
    expect(score.code).toBe('PALC');
    expect(score.date_marche).toBe('2026-07-07');
    expect(score.atr_score).toBeDefined();
    expect(score.atr_score).not.toBeNull();
    expect(score.consolidation_score).toBeDefined();
    expect(score.consolidation_score).not.toBeNull();
    expect(score.overall_confidence).toMatch(/HIGH|MEDIUM|LOW/);
    expect(score.patterns_detected_count).toBe(2);
    expect(score.combined_pattern_score).toBeGreaterThanOrEqual(-5);
    expect(score.combined_pattern_score).toBeLessThanOrEqual(5);
  });

  it('should calculate advisor delta for strong bullish signals', () => {
    const delta = calculateAdvisorDelta({
      atr_confidence: 'HIGH',
      consolidation_confidence: 'HIGH',
      overall_confidence: 'HIGH',
    });

    // HIGH + HIGH → strong bullish signal → positive delta
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThanOrEqual(5);
    // HIGH confidence with agreement bonus should be near max
    expect(delta).toBeGreaterThanOrEqual(4);
  });

  it('should handle missing patterns gracefully', () => {
    const score = aggregatePatterns([], 'PALC', '2026-07-07', 'v1.0.0');

    expect(score).toBeDefined();
    expect(score.code).toBe('PALC');
    expect(score.date_marche).toBe('2026-07-07');
    expect(score.atr_score).toBeNull();
    expect(score.consolidation_score).toBeNull();
    expect(score.combined_pattern_score).toBe(0);
    expect(score.overall_confidence).toBe('LOW');
    expect(score.patterns_detected_count).toBe(0);
    expect(score.advisor_sub_score_delta).toBe(0);
  });

  it('should calculate neutral delta for LOW confidence', () => {
    const delta = calculateAdvisorDelta({
      atr_confidence: null,
      consolidation_confidence: null,
      overall_confidence: 'LOW',
    });

    expect(delta).toBe(0);
  });

  it('should apply penalty when patterns conflict', () => {
    const deltaConflict = calculateAdvisorDelta({
      atr_confidence: 'HIGH',
      consolidation_confidence: 'LOW',
      overall_confidence: 'MEDIUM',
    });

    // Conflict between HIGH ATR and LOW consolidation
    expect(deltaConflict).toBeLessThanOrEqual(2);
  });

  it('should aggregate only VALID patterns correctly', () => {
    const patterns: QualifiedPattern[] = [
      {
        code: 'PALC',
        date_marche: '2026-07-07',
        pattern_type: 'atr_extreme',
        timeframe: '15m',
        candle_start_time: new Date('2026-07-07T10:00:00Z'),
        candle_end_time: new Date('2026-07-07T10:15:00Z'),
        value: 3.5,
        threshold: 2.0,
        is_triggered: true,
        engine_version: 'v1.0.0',
        rules_version: 'r1.0.0',
        quality_score: 0.95,
        confidence_level: 'HIGH',
        validation_status: 'VALID',
        explanation_fr: 'Volatilité extrême (ATR): Signal valide (confiance: HIGH)',
      },
      {
        code: 'PALC',
        date_marche: '2026-07-07',
        pattern_type: 'atr_extreme',
        timeframe: '15m',
        candle_start_time: new Date('2026-07-07T10:30:00Z'),
        candle_end_time: new Date('2026-07-07T10:45:00Z'),
        value: 0.5,
        threshold: 2.0,
        is_triggered: false,
        engine_version: 'v1.0.0',
        rules_version: 'r1.0.0',
        quality_score: 0.25,
        confidence_level: 'LOW',
        validation_status: 'INVALID',
        explanation_fr: 'Volatilité extrême (ATR): Signal faible (confiance: LOW)',
      },
    ];

    const score = aggregatePatterns(patterns, 'PALC', '2026-07-07', 'v1.0.0');

    // Should only consider the VALID pattern
    expect(score.atr_score).toBeDefined();
    expect(score.atr_score).not.toBeNull();
    expect(score.atr_confidence).toBe('HIGH');
  });

  it('should calculate combined score correctly', () => {
    const patterns: QualifiedPattern[] = [
      {
        code: 'PALC',
        date_marche: '2026-07-07',
        pattern_type: 'atr_extreme',
        timeframe: '15m',
        candle_start_time: new Date('2026-07-07T10:00:00Z'),
        candle_end_time: new Date('2026-07-07T10:15:00Z'),
        value: 3.5,
        threshold: 2.0,
        is_triggered: true,
        engine_version: 'v1.0.0',
        rules_version: 'r1.0.0',
        quality_score: 1.0,
        confidence_level: 'HIGH',
        validation_status: 'VALID',
        explanation_fr: 'Volatilité extrême (ATR): Signal valide (confiance: HIGH)',
      },
      {
        code: 'PALC',
        date_marche: '2026-07-07',
        pattern_type: 'bullish_consolidation',
        timeframe: '15m',
        candle_start_time: new Date('2026-07-07T10:15:00Z'),
        candle_end_time: new Date('2026-07-07T10:30:00Z'),
        value: 0.8,
        threshold: 1.0,
        is_triggered: true,
        engine_version: 'v1.0.0',
        rules_version: 'r1.0.0',
        quality_score: 1.0,
        confidence_level: 'MEDIUM',
        validation_status: 'QUESTIONABLE',
        explanation_fr: 'Consolidation haussière: Signal modéré (confiance: MEDIUM)',
      },
    ];

    const score = aggregatePatterns(patterns, 'PALC', '2026-07-07', 'v1.0.0');

    // combined_pattern_score should be average of sub-scores
    // atr_score: 4 (HIGH, quality 1.0)
    // consolidation_score: 2 (MEDIUM, quality 1.0)
    // combined: (4 + 2) / 2 = 3
    expect(score.combined_pattern_score).toBe(3);
  });
});
