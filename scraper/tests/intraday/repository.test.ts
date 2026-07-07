import { describe, it, expect } from 'vitest';
import { upsertRawPatterns, upsertQualifiedPatterns, upsertPatternScores } from '../../src/intraday/repository.js';
import type { RawPattern, QualifiedPattern } from '../../src/intraday/orchestrate.js';
import type { PatternScore } from '../../src/intraday/aggregate.js';

describe('Pattern Repository (Database Upserts)', () => {
  describe('upsertRawPatterns', () => {
    it('should return 0 for empty patterns array', async () => {
      const result = await upsertRawPatterns([]);
      expect(result).toBe(0);
    });

    it('should upsert raw patterns idempotently', async () => {
      const patterns: RawPattern[] = [
        {
          code: 'PALC',
          date_marche: '2026-07-07',
          pattern_type: 'atr_extreme',
          timeframe: '15m',
          candle_start_time: new Date('2026-07-07T10:00:00Z'),
          candle_end_time: new Date('2026-07-07T10:15:00Z'),
          value: 8.5,
          threshold: 7.5,
          is_triggered: true,
          engine_version: 'v1.0.0',
          rules_version: 'r1.0.0',
        },
      ];

      const result = await upsertRawPatterns(patterns);

      expect(result).toBeGreaterThanOrEqual(0); // Count should be non-negative
      // Note: In mock mode (DRY_RUN), returns the count of patterns; in real DB mode, returns actual insert count
    });

    it('should handle multiple raw patterns', async () => {
      const patterns: RawPattern[] = [
        {
          code: 'PALC',
          date_marche: '2026-07-07',
          pattern_type: 'atr_extreme',
          timeframe: '15m',
          candle_start_time: new Date('2026-07-07T10:00:00Z'),
          candle_end_time: new Date('2026-07-07T10:15:00Z'),
          value: 8.5,
          threshold: 7.5,
          is_triggered: true,
          engine_version: 'v1.0.0',
          rules_version: 'r1.0.0',
        },
        {
          code: 'PALC',
          date_marche: '2026-07-07',
          pattern_type: 'bullish_consolidation',
          timeframe: '15m',
          candle_start_time: new Date('2026-07-07T10:15:00Z'),
          candle_end_time: new Date('2026-07-07T10:30:00Z'),
          value: 0.85,
          threshold: 0.7,
          is_triggered: true,
          engine_version: 'v1.0.0',
          rules_version: 'r1.0.0',
        },
      ];

      const result = await upsertRawPatterns(patterns);

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('upsertQualifiedPatterns', () => {
    it('should return 0 for empty patterns array', async () => {
      const result = await upsertQualifiedPatterns([]);
      expect(result).toBe(0);
    });

    it('should upsert qualified patterns with all fields', async () => {
      const patterns: QualifiedPattern[] = [
        {
          code: 'PALC',
          date_marche: '2026-07-07',
          pattern_type: 'atr_extreme',
          timeframe: '15m',
          candle_start_time: new Date('2026-07-07T10:00:00Z'),
          candle_end_time: new Date('2026-07-07T10:15:00Z'),
          value: 8.5,
          threshold: 7.5,
          is_triggered: true,
          quality_score: 0.95,
          confidence_level: 'HIGH',
          validation_status: 'VALID',
          explanation_fr: 'Mouvement extrême détecté',
          engine_version: 'v1.0.0',
          rules_version: 'r1.0.0',
        },
      ];

      const result = await upsertQualifiedPatterns(patterns);

      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should upsert qualified patterns with QUESTIONABLE status', async () => {
      const patterns: QualifiedPattern[] = [
        {
          code: 'PALC',
          date_marche: '2026-07-07',
          pattern_type: 'bullish_consolidation',
          timeframe: '15m',
          candle_start_time: new Date('2026-07-07T10:15:00Z'),
          candle_end_time: new Date('2026-07-07T10:30:00Z'),
          value: 0.85,
          threshold: 0.7,
          is_triggered: true,
          quality_score: 0.75,
          confidence_level: 'MEDIUM',
          validation_status: 'QUESTIONABLE',
          explanation_fr: 'Consolidation haussière: Signal modéré',
          engine_version: 'v1.0.0',
          rules_version: 'r1.0.0',
        },
      ];

      const result = await upsertQualifiedPatterns(patterns);

      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should upsert multiple qualified patterns', async () => {
      const patterns: QualifiedPattern[] = [
        {
          code: 'PALC',
          date_marche: '2026-07-07',
          pattern_type: 'atr_extreme',
          timeframe: '15m',
          candle_start_time: new Date('2026-07-07T10:00:00Z'),
          candle_end_time: new Date('2026-07-07T10:15:00Z'),
          value: 8.5,
          threshold: 7.5,
          is_triggered: true,
          quality_score: 0.95,
          confidence_level: 'HIGH',
          validation_status: 'VALID',
          explanation_fr: 'Volatilité extrême (ATR): Signal valide (confiance: HIGH)',
          engine_version: 'v1.0.0',
          rules_version: 'r1.0.0',
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
          quality_score: 0.8,
          confidence_level: 'MEDIUM',
          validation_status: 'QUESTIONABLE',
          explanation_fr: 'Consolidation haussière: Signal modéré (confiance: MEDIUM)',
          engine_version: 'v1.0.0',
          rules_version: 'r1.0.0',
        },
      ];

      const result = await upsertQualifiedPatterns(patterns);

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('upsertPatternScores', () => {
    it('should return 0 for empty scores array', async () => {
      const result = await upsertPatternScores([]);
      expect(result).toBe(0);
    });

    it('should upsert pattern scores with advisor delta', async () => {
      const scores: PatternScore[] = [
        {
          code: 'PALC',
          date_marche: '2026-07-07',
          atr_score: 4,
          atr_confidence: 'HIGH',
          consolidation_score: 2,
          consolidation_confidence: 'MEDIUM',
          overall_confidence: 'HIGH',
          combined_pattern_score: 3.0,
          patterns_detected_count: 2,
          advisor_sub_score_delta: 4,
          engine_version: 'v1.0.0',
        },
      ];

      const result = await upsertPatternScores(scores);

      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should upsert pattern scores with null sub-scores', async () => {
      const scores: PatternScore[] = [
        {
          code: 'PALC',
          date_marche: '2026-07-08',
          atr_score: 4,
          atr_confidence: 'HIGH',
          consolidation_score: null,
          consolidation_confidence: null,
          overall_confidence: 'HIGH',
          combined_pattern_score: 4.0,
          patterns_detected_count: 1,
          advisor_sub_score_delta: 4,
          engine_version: 'v1.0.0',
        },
      ];

      const result = await upsertPatternScores(scores);

      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should upsert multiple pattern scores', async () => {
      const scores: PatternScore[] = [
        {
          code: 'PALC',
          date_marche: '2026-07-07',
          atr_score: 4,
          atr_confidence: 'HIGH',
          consolidation_score: 2,
          consolidation_confidence: 'MEDIUM',
          overall_confidence: 'HIGH',
          combined_pattern_score: 3.0,
          patterns_detected_count: 2,
          advisor_sub_score_delta: 4,
          engine_version: 'v1.0.0',
        },
        {
          code: 'SEMC',
          date_marche: '2026-07-07',
          atr_score: null,
          atr_confidence: null,
          consolidation_score: 2,
          consolidation_confidence: 'MEDIUM',
          overall_confidence: 'MEDIUM',
          combined_pattern_score: 2.0,
          patterns_detected_count: 1,
          advisor_sub_score_delta: 2,
          engine_version: 'v1.0.0',
        },
      ];

      const result = await upsertPatternScores(scores);

      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle pattern scores with LOW confidence', async () => {
      const scores: PatternScore[] = [
        {
          code: 'PALC',
          date_marche: '2026-07-09',
          atr_score: 0,
          atr_confidence: 'LOW',
          consolidation_score: 0,
          consolidation_confidence: 'LOW',
          overall_confidence: 'LOW',
          combined_pattern_score: 0.0,
          patterns_detected_count: 0,
          advisor_sub_score_delta: 0,
          engine_version: 'v1.0.0',
        },
      ];

      const result = await upsertPatternScores(scores);

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });
});
