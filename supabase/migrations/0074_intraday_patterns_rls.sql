-- Migration: Enable RLS on intraday pattern tables
-- Purpose: Enforce read-only access for public users; restrict writes to service_role (scraper)
-- Date: 2026-07-07

-- ============================================================================
-- ENABLE RLS ON ALL 9 PATTERN TABLES
-- ============================================================================

ALTER TABLE public.brvm_pattern_engine_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_intraday_candles_15m ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_intraday_candles_30m ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_intraday_patterns_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_intraday_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_pattern_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_intraday_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_intraday_integrity_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_pattern_errors ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- brvm_pattern_engine_config: Configuration data
-- Access: SELECT all, INSERT/UPDATE service_role only
-- ============================================================================

CREATE POLICY IF NOT EXISTS select_all_engine_config ON public.brvm_pattern_engine_config
  FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS insert_service_role_engine_config ON public.brvm_pattern_engine_config
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS update_service_role_engine_config ON public.brvm_pattern_engine_config
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- brvm_intraday_candles_15m: 15-minute reconstructed candles (partitioned)
-- Access: SELECT all, INSERT/UPDATE/DELETE service_role only
-- ============================================================================

CREATE POLICY IF NOT EXISTS select_all_candles_15m ON public.brvm_intraday_candles_15m
  FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS insert_service_role_candles_15m ON public.brvm_intraday_candles_15m
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS update_service_role_candles_15m ON public.brvm_intraday_candles_15m
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS delete_service_role_candles_15m ON public.brvm_intraday_candles_15m
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- brvm_intraday_candles_30m: 30-minute reconstructed candles (partitioned)
-- Access: SELECT all, INSERT/UPDATE/DELETE service_role only
-- ============================================================================

CREATE POLICY IF NOT EXISTS select_all_candles_30m ON public.brvm_intraday_candles_30m
  FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS insert_service_role_candles_30m ON public.brvm_intraday_candles_30m
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS update_service_role_candles_30m ON public.brvm_intraday_candles_30m
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS delete_service_role_candles_30m ON public.brvm_intraday_candles_30m
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- brvm_intraday_patterns_raw: Raw pattern detections (partitioned, PHASE 3A)
-- Access: SELECT all, INSERT/UPDATE service_role only
-- ============================================================================

CREATE POLICY IF NOT EXISTS select_all_patterns_raw ON public.brvm_intraday_patterns_raw
  FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS insert_service_role_patterns_raw ON public.brvm_intraday_patterns_raw
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS update_service_role_patterns_raw ON public.brvm_intraday_patterns_raw
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- brvm_intraday_patterns: Qualified patterns (partitioned, PHASE 3B)
-- Access: SELECT all, INSERT/UPDATE service_role only
-- ============================================================================

CREATE POLICY IF NOT EXISTS select_all_patterns ON public.brvm_intraday_patterns
  FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS insert_service_role_patterns ON public.brvm_intraday_patterns
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS update_service_role_patterns ON public.brvm_intraday_patterns
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- brvm_pattern_scores: Aggregated pattern scores (PHASE 4)
-- Access: SELECT all, INSERT/UPDATE service_role only
-- ============================================================================

CREATE POLICY IF NOT EXISTS select_all_pattern_scores ON public.brvm_pattern_scores
  FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS insert_service_role_pattern_scores ON public.brvm_pattern_scores
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS update_service_role_pattern_scores ON public.brvm_pattern_scores
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- brvm_intraday_job_runs: Audit trail for pattern engine job execution
-- Access: SELECT all, INSERT/UPDATE/DELETE service_role only
-- ============================================================================

CREATE POLICY IF NOT EXISTS select_all_job_runs ON public.brvm_intraday_job_runs
  FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS insert_service_role_job_runs ON public.brvm_intraday_job_runs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS update_service_role_job_runs ON public.brvm_intraday_job_runs
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS delete_service_role_job_runs ON public.brvm_intraday_job_runs
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- brvm_intraday_integrity_checks: PHASE 0 data quality validation
-- Access: SELECT all, INSERT/DELETE service_role only (no UPDATE)
-- ============================================================================

CREATE POLICY IF NOT EXISTS select_all_integrity_checks ON public.brvm_intraday_integrity_checks
  FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS insert_service_role_integrity_checks ON public.brvm_intraday_integrity_checks
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS delete_service_role_integrity_checks ON public.brvm_intraday_integrity_checks
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- brvm_pattern_errors: Error logging from pattern engine phases
-- Access: SELECT all, INSERT service_role only
-- ============================================================================

CREATE POLICY IF NOT EXISTS select_all_pattern_errors ON public.brvm_pattern_errors
  FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS insert_service_role_pattern_errors ON public.brvm_pattern_errors
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
