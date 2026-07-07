-- Seed default pattern detection configuration
-- Task 5: Intraday Patterns Phase 1 — Pattern Engine Config
--
-- This migration seeds the brvm_pattern_engine_config table with the default
-- configuration for ATR and consolidation pattern detection.
--
-- Values are calibrated for 15-minute candles on BRVM equities:
-- - ATR period 14 is standard for technical analysis
-- - ATR multiplier 3.0 targets 3-sigma extreme moves
-- - Consolidation requires ≥3 bars with tight bodies (≤30% of range)

INSERT INTO public.brvm_pattern_engine_config (
  engine_version,
  rules_version,
  atr_period,
  atr_multiplier,
  min_snapshots_for_complete,
  min_quality_score_for_valid,
  consolidation_min_bars,
  consolidation_max_body_ratio,
  metadata,
  is_active
) VALUES (
  'v1.0.0',
  'r1.0.0',
  14,                    -- ATR period in candles (standard for 15m timeframe)
  3.0,                   -- ATR multiplier for extreme detection (3-sigma)
  4,                     -- Min snapshots needed for complete 15m candle
  0.5,                   -- Min quality score (0.5 = 50% data coverage) to consider valid
  3,                     -- Min consecutive bars for consolidation pattern
  0.3,                   -- Max body-to-range ratio for consolidation (0.3 = 30% bodies)
  jsonb_build_object(
    'description', 'Initial production configuration for BRVM intraday patterns',
    'created_by', 'system',
    'notes', 'ATR multiplier 3.0 targets 3-sigma extreme moves. Consolidation requires tight bodies (<30% of range).',
    'calibrated_date', NOW()::date,
    'source', 'Task 5 — Pattern Engine Configuration Seed'
  ),
  true                   -- This is the active default configuration
) ON CONFLICT (engine_version, rules_version) DO NOTHING;

-- Note: Alternative configurations can be added later for A/B testing or sensitivity analysis.
-- For now, only v1.0.0 / r1.0.0 is active.
