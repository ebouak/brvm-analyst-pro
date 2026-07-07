-- brvm_pattern_engine_config: Versioned configuration
CREATE TABLE IF NOT EXISTS public.brvm_pattern_engine_config (
  id SERIAL PRIMARY KEY,
  engine_version TEXT NOT NULL UNIQUE,
  rules_version TEXT NOT NULL,
  atr_period INTEGER DEFAULT 14,
  atr_multiplier DECIMAL(3,2) DEFAULT 3.0,
  min_snapshots_for_complete INTEGER DEFAULT 4,
  min_quality_score_for_valid DECIMAL(3,2) DEFAULT 0.5,
  consolidation_min_bars INTEGER DEFAULT 3,
  consolidation_max_body_ratio DECIMAL(3,2) DEFAULT 0.3,
  metadata JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_quality_score CHECK (min_quality_score_for_valid BETWEEN 0 AND 1),
  CONSTRAINT chk_atr_multiplier CHECK (atr_multiplier > 0)
);

CREATE INDEX IF NOT EXISTS idx_engine_config_active ON public.brvm_pattern_engine_config(is_active);

-- brvm_intraday_candles_15m: Reconstructed 15-min candles
CREATE TABLE IF NOT EXISTS public.brvm_intraday_candles_15m (
  id BIGSERIAL,
  code TEXT NOT NULL,
  date_marche DATE NOT NULL,
  time_start TIMESTAMPTZ NOT NULL,
  time_end TIMESTAMPTZ NOT NULL,
  open DECIMAL(19,8),
  high DECIMAL(19,8),
  low DECIMAL(19,8),
  close DECIMAL(19,8),
  volume BIGINT,
  sample_count INTEGER,
  quality_score DECIMAL(3,2),
  is_complete BOOLEAN,
  is_synthetic BOOLEAN DEFAULT true,
  source TEXT DEFAULT 'brvm_public_snapshot',
  engine_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_code FOREIGN KEY (code) REFERENCES public.brvm_instruments(code) ON UPDATE CASCADE,
  CONSTRAINT chk_quality CHECK (quality_score BETWEEN 0 AND 1),
  PRIMARY KEY (code, date_marche, time_start, engine_version)
) PARTITION BY RANGE (date_marche);

-- Create initial partitions (2026-06, 2026-07, 2026-08, 2026-09)
CREATE TABLE IF NOT EXISTS public.brvm_intraday_candles_15m_2026_06 PARTITION OF public.brvm_intraday_candles_15m
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS public.brvm_intraday_candles_15m_2026_07 PARTITION OF public.brvm_intraday_candles_15m
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS public.brvm_intraday_candles_15m_2026_08 PARTITION OF public.brvm_intraday_candles_15m
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS public.brvm_intraday_candles_15m_2026_09 PARTITION OF public.brvm_intraday_candles_15m
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE INDEX IF NOT EXISTS idx_candles_15m_code_date ON public.brvm_intraday_candles_15m(code, date_marche);
CREATE INDEX IF NOT EXISTS idx_candles_15m_quality ON public.brvm_intraday_candles_15m(quality_score);

-- brvm_intraday_candles_30m: Reconstructed 30-min candles (same structure)
CREATE TABLE IF NOT EXISTS public.brvm_intraday_candles_30m (
  id BIGSERIAL,
  code TEXT NOT NULL,
  date_marche DATE NOT NULL,
  time_start TIMESTAMPTZ NOT NULL,
  time_end TIMESTAMPTZ NOT NULL,
  open DECIMAL(19,8),
  high DECIMAL(19,8),
  low DECIMAL(19,8),
  close DECIMAL(19,8),
  volume BIGINT,
  sample_count INTEGER,
  quality_score DECIMAL(3,2),
  is_complete BOOLEAN,
  is_synthetic BOOLEAN DEFAULT true,
  source TEXT DEFAULT 'brvm_intraday_candles_15m_aggregated',
  engine_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_code FOREIGN KEY (code) REFERENCES public.brvm_instruments(code) ON UPDATE CASCADE,
  CONSTRAINT chk_quality CHECK (quality_score BETWEEN 0 AND 1),
  PRIMARY KEY (code, date_marche, time_start, engine_version)
) PARTITION BY RANGE (date_marche);

CREATE TABLE IF NOT EXISTS public.brvm_intraday_candles_30m_2026_06 PARTITION OF public.brvm_intraday_candles_30m
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS public.brvm_intraday_candles_30m_2026_07 PARTITION OF public.brvm_intraday_candles_30m
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS public.brvm_intraday_candles_30m_2026_08 PARTITION OF public.brvm_intraday_candles_30m
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS public.brvm_intraday_candles_30m_2026_09 PARTITION OF public.brvm_intraday_candles_30m
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE INDEX IF NOT EXISTS idx_candles_30m_code_date ON public.brvm_intraday_candles_30m(code, date_marche);

-- brvm_intraday_patterns_raw: Raw detections (PHASE 3A)
CREATE TABLE IF NOT EXISTS public.brvm_intraday_patterns_raw (
  id BIGSERIAL,
  code TEXT NOT NULL,
  date_marche DATE NOT NULL,
  pattern_type TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  candle_start_time TIMESTAMPTZ NOT NULL,
  candle_end_time TIMESTAMPTZ NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  value DECIMAL(19,8),
  threshold DECIMAL(19,8),
  is_triggered BOOLEAN NOT NULL,
  metadata JSONB,
  engine_version TEXT NOT NULL,
  rules_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_code FOREIGN KEY (code) REFERENCES public.brvm_instruments(code) ON UPDATE CASCADE,
  CONSTRAINT chk_pattern_type CHECK (pattern_type IN ('atr_extreme', 'bullish_consolidation')),
  CONSTRAINT chk_timeframe CHECK (timeframe IN ('15m', '30m')),
  PRIMARY KEY (code, date_marche, pattern_type, timeframe, candle_start_time, engine_version)
) PARTITION BY RANGE (date_marche);

CREATE TABLE IF NOT EXISTS public.brvm_intraday_patterns_raw_2026_06 PARTITION OF public.brvm_intraday_patterns_raw
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS public.brvm_intraday_patterns_raw_2026_07 PARTITION OF public.brvm_intraday_patterns_raw
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS public.brvm_intraday_patterns_raw_2026_08 PARTITION OF public.brvm_intraday_patterns_raw
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS public.brvm_intraday_patterns_raw_2026_09 PARTITION OF public.brvm_intraday_patterns_raw
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE INDEX IF NOT EXISTS idx_patterns_raw_date ON public.brvm_intraday_patterns_raw(code, date_marche);
CREATE INDEX IF NOT EXISTS idx_patterns_raw_triggered ON public.brvm_intraday_patterns_raw(is_triggered);

-- brvm_intraday_patterns: Qualified patterns (PHASE 3B)
CREATE TABLE IF NOT EXISTS public.brvm_intraday_patterns (
  id BIGSERIAL,
  code TEXT NOT NULL,
  date_marche DATE NOT NULL,
  pattern_type TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  candle_start_time TIMESTAMPTZ NOT NULL,
  candle_end_time TIMESTAMPTZ NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL,
  is_triggered BOOLEAN NOT NULL,
  value DECIMAL(19,8),
  threshold DECIMAL(19,8),
  quality_score DECIMAL(3,2),
  confidence_level TEXT NOT NULL,
  associated_news_count INTEGER DEFAULT 0,
  associated_news_ids TEXT[],
  has_fundamental_trigger BOOLEAN,
  validation_status TEXT NOT NULL,
  explanation_fr TEXT,
  engine_version TEXT NOT NULL,
  rules_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_code FOREIGN KEY (code) REFERENCES public.brvm_instruments(code) ON UPDATE CASCADE,
  CONSTRAINT chk_pattern_type CHECK (pattern_type IN ('atr_extreme', 'bullish_consolidation')),
  CONSTRAINT chk_confidence CHECK (confidence_level IN ('HIGH', 'MEDIUM', 'LOW')),
  CONSTRAINT chk_validation CHECK (validation_status IN ('VALID', 'QUESTIONABLE', 'INVALID')),
  PRIMARY KEY (code, date_marche, pattern_type, timeframe, candle_start_time, engine_version)
) PARTITION BY RANGE (date_marche);

CREATE TABLE IF NOT EXISTS public.brvm_intraday_patterns_2026_06 PARTITION OF public.brvm_intraday_patterns
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS public.brvm_intraday_patterns_2026_07 PARTITION OF public.brvm_intraday_patterns
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS public.brvm_intraday_patterns_2026_08 PARTITION OF public.brvm_intraday_patterns
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS public.brvm_intraday_patterns_2026_09 PARTITION OF public.brvm_intraday_patterns
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE INDEX IF NOT EXISTS idx_patterns_date ON public.brvm_intraday_patterns(code, date_marche);
CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON public.brvm_intraday_patterns(confidence_level);

-- brvm_pattern_scores: Aggregated scores (PHASE 4)
CREATE TABLE IF NOT EXISTS public.brvm_pattern_scores (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  date_marche DATE NOT NULL,
  atr_score INTEGER,
  atr_confidence TEXT,
  atr_explanation_fr TEXT,
  consolidation_score INTEGER,
  consolidation_confidence TEXT,
  consolidation_explanation_fr TEXT,
  overall_confidence TEXT NOT NULL,
  combined_pattern_score DECIMAL(5,2),
  patterns_detected_count INTEGER,
  patterns_with_news_count INTEGER,
  advisor_impact_estimate DECIMAL(5,2),
  advisor_sub_score_delta DECIMAL(5,2),
  engine_version TEXT NOT NULL,
  rules_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(code, date_marche),
  CONSTRAINT fk_code FOREIGN KEY (code) REFERENCES public.brvm_instruments(code) ON UPDATE CASCADE,
  CONSTRAINT chk_atr_confidence CHECK (atr_confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  CONSTRAINT chk_consolidation_confidence CHECK (consolidation_confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  CONSTRAINT chk_overall_confidence CHECK (overall_confidence IN ('HIGH', 'MEDIUM', 'LOW'))
);

CREATE INDEX IF NOT EXISTS idx_pattern_scores_date ON public.brvm_pattern_scores(date_marche);
CREATE INDEX IF NOT EXISTS idx_pattern_scores_advisor_delta ON public.brvm_pattern_scores(advisor_sub_score_delta);

-- brvm_intraday_job_runs: Audit trail
CREATE TABLE IF NOT EXISTS public.brvm_intraday_job_runs (
  id BIGSERIAL PRIMARY KEY,
  date_marche DATE NOT NULL,
  phase TEXT NOT NULL,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  rows_in INTEGER,
  rows_out INTEGER,
  errors_count INTEGER DEFAULT 0,
  warnings_count INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date_marche, phase),
  CONSTRAINT chk_status CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL', 'SUPERSEDED')),
  CONSTRAINT chk_phase CHECK (phase IN ('integrity_check', 'reconstruct', 'detect_raw', 'qualify', 'aggregate'))
);

CREATE INDEX IF NOT EXISTS idx_job_runs_date_phase ON public.brvm_intraday_job_runs(date_marche, phase);
CREATE INDEX IF NOT EXISTS idx_job_runs_status ON public.brvm_intraday_job_runs(status);

-- brvm_intraday_integrity_checks: PHASE 0 validation
CREATE TABLE IF NOT EXISTS public.brvm_intraday_integrity_checks (
  id BIGSERIAL PRIMARY KEY,
  date_marche DATE NOT NULL,
  code TEXT REFERENCES public.brvm_instruments(code) ON UPDATE CASCADE,
  check_type TEXT NOT NULL,
  status TEXT NOT NULL,
  metric_name TEXT,
  threshold_value DECIMAL,
  actual_value DECIMAL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_check_type CHECK (check_type IN ('snapshot_count', 'timestamp_continuity', 'missing_fields', 'volume_plausibility')),
  CONSTRAINT chk_integrity_status CHECK (status IN ('PASS', 'WARN', 'FAIL'))
);

CREATE INDEX IF NOT EXISTS idx_integrity_date ON public.brvm_intraday_integrity_checks(date_marche);
CREATE INDEX IF NOT EXISTS idx_integrity_code ON public.brvm_intraday_integrity_checks(code);

CREATE UNIQUE INDEX IF NOT EXISTS uq_integrity_check ON public.brvm_intraday_integrity_checks (date_marche, check_type, COALESCE(code, 'global'));

-- brvm_pattern_errors: Error logging
CREATE TABLE IF NOT EXISTS public.brvm_pattern_errors (
  id BIGSERIAL PRIMARY KEY,
  date_marche DATE NOT NULL,
  phase TEXT NOT NULL,
  code TEXT REFERENCES public.brvm_instruments(code) ON UPDATE CASCADE,
  table_name TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_code TEXT,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_phase CHECK (phase IN ('integrity_check', 'reconstruct', 'detect_raw', 'qualify', 'aggregate'))
);

CREATE INDEX IF NOT EXISTS idx_errors_date_phase ON public.brvm_pattern_errors(date_marche, phase);
CREATE INDEX IF NOT EXISTS idx_errors_code ON public.brvm_pattern_errors(code);
CREATE INDEX IF NOT EXISTS idx_errors_table ON public.brvm_pattern_errors(table_name);
