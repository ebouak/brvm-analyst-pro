-- ============================================================================
-- 0078_intraday_patterns.sql
-- Intraday pattern detection tables (Phase 2-4 of pattern detection pipeline)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Pattern engine configuration (PHASE 0 — config)
-- ---------------------------------------------------------------------------

create table if not exists public.pattern_engine_config (
  id serial primary key,
  engine_version text not null,
  rules_version text not null,
  atr_period integer not null default 14,
  atr_multiplier numeric(10,4) not null default 2.0,
  min_snapshots_for_complete integer not null default 3,
  min_quality_score_for_valid numeric(10,2) not null default 0.5,
  consolidation_min_bars integer not null default 3,
  consolidation_max_body_ratio numeric(10,4) not null default 0.3,
  metadata jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (engine_version, rules_version)
);

-- ---------------------------------------------------------------------------
-- 2. Reconstructed 15-minute candles (PHASE 2)
-- ---------------------------------------------------------------------------

create table if not exists public.intraday_candle_15m (
  id bigserial primary key,
  code text not null,
  date_marche date not null,
  time_start time not null,
  time_end time not null,
  open numeric(20,4) not null,
  high numeric(20,4) not null,
  low numeric(20,4) not null,
  close numeric(20,4) not null,
  volume bigint,
  sample_count integer,
  quality_score numeric(10,2),
  is_complete boolean not null default false,
  is_synthetic boolean not null default false,
  source text,
  engine_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, date_marche, time_start, time_end)
);

create index if not exists idx_intraday_candle_15m_code_date
  on public.intraday_candle_15m (code, date_marche);

-- ---------------------------------------------------------------------------
-- 3. Reconstructed 30-minute candles (PHASE 2 aggregated from 15m)
-- ---------------------------------------------------------------------------

create table if not exists public.intraday_candle_30m (
  id bigserial primary key,
  code text not null,
  date_marche date not null,
  time_start time not null,
  time_end time not null,
  open numeric(20,4) not null,
  high numeric(20,4) not null,
  low numeric(20,4) not null,
  close numeric(20,4) not null,
  volume bigint,
  sample_count integer,
  quality_score numeric(10,2),
  is_complete boolean not null default false,
  is_synthetic boolean not null default false,
  source text,
  engine_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, date_marche, time_start, time_end)
);

create index if not exists idx_intraday_candle_30m_code_date
  on public.intraday_candle_30m (code, date_marche);

-- ---------------------------------------------------------------------------
-- 4. Raw pattern detection results (PHASE 3A)
-- ---------------------------------------------------------------------------

create table if not exists public.intraday_pattern_raw (
  id bigserial primary key,
  code text not null,
  date_marche date not null,
  pattern_type text not null check (pattern_type in ('ATR_BREAKOUT', 'CONSOLIDATION', 'INSIDE_DAY', 'VOLUME_SPIKE')),
  timeframe text not null check (timeframe in ('15m', '30m', '1h', 'daily')),
  candle_start_time time,
  candle_end_time time,
  detected_at timestamptz,
  value numeric(20,4),
  threshold numeric(20,4),
  is_triggered boolean not null default false,
  metadata jsonb,
  engine_version text,
  rules_version text,
  created_at timestamptz not null default now()
);

create index if not exists idx_intraday_pattern_raw_code_date
  on public.intraday_pattern_raw (code, date_marche);

-- ---------------------------------------------------------------------------
-- 5. Qualified patterns (PHASE 3B) — Main patterns table
-- ---------------------------------------------------------------------------

create table if not exists public.brvm_intraday_patterns (
  id bigserial primary key,
  code text not null,
  date_marche date not null,
  pattern_type text not null check (pattern_type in ('ATR_BREAKOUT', 'CONSOLIDATION', 'INSIDE_DAY', 'VOLUME_SPIKE')),
  timeframe text not null check (timeframe in ('15m', '30m', '1h', 'daily')),
  candle_start_time time,
  candle_end_time time,
  detected_at timestamptz,
  is_triggered boolean not null default false,
  value numeric(20,4),
  threshold numeric(20,4),
  quality_score numeric(10,2) not null default 0.0,
  confidence_level text not null default 'LOW' check (confidence_level in ('LOW', 'MEDIUM', 'HIGH')),
  associated_news_count integer not null default 0,
  associated_news_ids text[],
  has_fundamental_trigger boolean not null default false,
  validation_status text not null default 'PENDING' check (validation_status in ('PENDING', 'VALID', 'INVALID', 'REJECTED')),
  explanation_fr text,
  engine_version text,
  rules_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_brvm_intraday_patterns_code_date
  on public.brvm_intraday_patterns (code, date_marche);

create index if not exists idx_brvm_intraday_patterns_validation
  on public.brvm_intraday_patterns (validation_status) where validation_status = 'VALID';

create index if not exists idx_brvm_intraday_patterns_confidence
  on public.brvm_intraday_patterns (confidence_level);

-- ---------------------------------------------------------------------------
-- 6. Aggregated pattern scores (PHASE 4)
-- ---------------------------------------------------------------------------

create table if not exists public.brvm_pattern_scores (
  id serial primary key,
  code text not null,
  date_marche date not null,
  atr_score numeric(10,2),
  atr_confidence text check (atr_confidence in ('LOW', 'MEDIUM', 'HIGH')),
  atr_explanation_fr text,
  consolidation_score numeric(10,2),
  consolidation_confidence text check (consolidation_confidence in ('LOW', 'MEDIUM', 'HIGH')),
  consolidation_explanation_fr text,
  overall_confidence text not null default 'LOW' check (overall_confidence in ('LOW', 'MEDIUM', 'HIGH')),
  combined_pattern_score numeric(10,2),
  patterns_detected_count integer not null default 0,
  patterns_with_news_count integer not null default 0,
  advisor_impact_estimate numeric(10,2),
  advisor_sub_score_delta numeric(10,4),
  engine_version text,
  rules_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, date_marche)
);

create index if not exists idx_brvm_pattern_scores_code_date
  on public.brvm_pattern_scores (code, date_marche);

-- ---------------------------------------------------------------------------
-- 7. Job execution audit trail
-- ---------------------------------------------------------------------------

create table if not exists public.intraday_job_run (
  id serial primary key,
  date_marche date not null,
  phase text not null check (phase in ('PHASE_0_INTEGRITY', 'PHASE_1_INGEST', 'PHASE_2_RECONSTRUCT', 'PHASE_3_DETECT', 'PHASE_4_SCORE')),
  job_name text not null,
  status text not null check (status in ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL')),
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  rows_in integer,
  rows_out integer,
  errors_count integer not null default 0,
  warnings_count integer not null default 0,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_intraday_job_run_date_phase
  on public.intraday_job_run (date_marche, phase);

-- ---------------------------------------------------------------------------
-- 8. Data integrity check results
-- ---------------------------------------------------------------------------

create table if not exists public.intraday_integrity_check (
  id serial primary key,
  date_marche date not null,
  code text,
  check_type text not null check (check_type in ('DATA_COMPLETENESS', 'OUTLIER_DETECTION', 'SCHEMA_VALIDATION', 'CONTINUITY')),
  status text not null check (status in ('PASS', 'WARN', 'FAIL')),
  metric_name text,
  threshold_value numeric(20,4),
  actual_value numeric(20,4),
  message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_intraday_integrity_check_date
  on public.intraday_integrity_check (date_marche);

-- ---------------------------------------------------------------------------
-- 9. Pipeline error log
-- ---------------------------------------------------------------------------

create table if not exists public.pattern_error_log (
  id serial primary key,
  date_marche date not null,
  phase text not null check (phase in ('PHASE_0_INTEGRITY', 'PHASE_1_INGEST', 'PHASE_2_RECONSTRUCT', 'PHASE_3_DETECT', 'PHASE_4_SCORE')),
  code text,
  table_name text,
  error_message text not null,
  error_code text,
  context jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pattern_error_log_date_phase
  on public.pattern_error_log (date_marche, phase);

-- ---------------------------------------------------------------------------
-- 10. RLS : lecture publique, écriture service_role uniquement
-- ---------------------------------------------------------------------------

alter table public.brvm_intraday_patterns enable row level security;
alter table public.brvm_pattern_scores enable row level security;

drop policy if exists "intraday_patterns_public_read" on public.brvm_intraday_patterns;
create policy "intraday_patterns_public_read"
  on public.brvm_intraday_patterns for select using (true);

drop policy if exists "pattern_scores_public_read" on public.brvm_pattern_scores;
create policy "pattern_scores_public_read"
  on public.brvm_pattern_scores for select using (true);

revoke insert, update, delete on public.brvm_intraday_patterns from anon, authenticated;
revoke insert, update, delete on public.brvm_pattern_scores from anon, authenticated;

-- ============================================================================
-- End of migration 0078_intraday_patterns.sql
-- ============================================================================
