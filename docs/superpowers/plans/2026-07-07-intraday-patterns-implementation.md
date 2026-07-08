# Intraday Patterns for Advisor Enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the WESTBOURSE Conseiller with intraday ATR/consolidation pattern detection, aggregate into advisor sub-scores, and expose via screener + diagnostic IA.

**Architecture:** 4-phase implementation: (1) Supabase schema + RLS + partitioning, (2) Core pipeline (reconstruction → detection → qualification → aggregation), (3) Frontend integration (advisor enrichment + screener + diagnostic IA section), (4) E2E tests + GitHub Actions deployment.

**Tech Stack:** Supabase PostgreSQL (partitioned tables), Next.js 14 (API routes), Node.js ≥20 (scraper ESM), TypeScript strict, vitest (unit tests), GitHub Actions (cron).

---

## Phase 1: Schema & Setup (6 tasks)

### Task 1: Create Supabase Migrations for Core Pattern Tables

**Files:**
- Create: `supabase/migrations/0042_intraday_patterns_schema.sql`

- [ ] **Step 1: Write migration file with table definitions**

Create `supabase/migrations/0042_intraday_patterns_schema.sql`:

```sql
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

CREATE INDEX idx_engine_config_active ON public.brvm_pattern_engine_config(is_active);

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

CREATE INDEX idx_candles_15m_code_date ON public.brvm_intraday_candles_15m(code, date_marche);
CREATE INDEX idx_candles_15m_quality ON public.brvm_intraday_candles_15m(quality_score);

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

CREATE INDEX idx_candles_30m_code_date ON public.brvm_intraday_candles_30m(code, date_marche);
```

- [ ] **Step 2: Add pattern detection tables to migration**

Append to same migration file:

```sql
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

CREATE INDEX idx_patterns_raw_date ON public.brvm_intraday_patterns_raw(code, date_marche);
CREATE INDEX idx_patterns_raw_triggered ON public.brvm_intraday_patterns_raw(is_triggered);

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

CREATE INDEX idx_patterns_date ON public.brvm_intraday_patterns(code, date_marche);
CREATE INDEX idx_patterns_confidence ON public.brvm_intraday_patterns(confidence_level);
```

- [ ] **Step 3: Add aggregation, logs, and error tables to migration**

Append:

```sql
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

CREATE INDEX idx_pattern_scores_date ON public.brvm_pattern_scores(date_marche);
CREATE INDEX idx_pattern_scores_advisor_delta ON public.brvm_pattern_scores(advisor_sub_score_delta);

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

CREATE INDEX idx_job_runs_date_phase ON public.brvm_intraday_job_runs(date_marche, phase);
CREATE INDEX idx_job_runs_status ON public.brvm_intraday_job_runs(status);

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

CREATE INDEX idx_integrity_date ON public.brvm_intraday_integrity_checks(date_marche);
CREATE INDEX idx_integrity_code ON public.brvm_intraday_integrity_checks(code);

CREATE UNIQUE INDEX uq_integrity_check ON public.brvm_intraday_integrity_checks (date_marche, check_type, COALESCE(code, 'global'));

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

CREATE INDEX idx_errors_date_phase ON public.brvm_pattern_errors(date_marche, phase);
CREATE INDEX idx_errors_code ON public.brvm_pattern_errors(code);
CREATE INDEX idx_errors_table ON public.brvm_pattern_errors(table_name);
```

- [ ] **Step 4: Apply migration to Supabase**

```bash
cd c:\Users\adego\OneDrive\Documents\brvm-analyst-pro
npx supabase db push
```

Expected output: Migration applied, all tables created successfully.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0042_intraday_patterns_schema.sql
git commit -m "schema(patterns): add intraday pattern detection tables with partitioning and RLS"
```

---

### Task 2: Configure RLS Policies for Pattern Tables

**Files:**
- Create: `supabase/migrations/0042_intraday_patterns_rls.sql` (or append to 0042)

- [ ] **Step 1: Add RLS policies to migration**

```sql
-- Enable RLS on all pattern tables
ALTER TABLE public.brvm_pattern_engine_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_intraday_candles_15m ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_intraday_candles_30m ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_intraday_patterns_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_intraday_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_pattern_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_intraday_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_intraday_integrity_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brvm_pattern_errors ENABLE ROW LEVEL SECURITY;

-- pattern_engine_config: SELECT public, INSERT/UPDATE service_role
CREATE POLICY select_all ON public.brvm_pattern_engine_config FOR SELECT USING (true);
CREATE POLICY insert_service_role ON public.brvm_pattern_engine_config FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY update_service_role ON public.brvm_pattern_engine_config FOR UPDATE USING (auth.role() = 'service_role');

-- candles_15m: SELECT public, INSERT/UPDATE/DELETE service_role
CREATE POLICY select_all ON public.brvm_intraday_candles_15m FOR SELECT USING (true);
CREATE POLICY insert_service_role ON public.brvm_intraday_candles_15m FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY update_service_role ON public.brvm_intraday_candles_15m FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY delete_service_role ON public.brvm_intraday_candles_15m FOR DELETE USING (auth.role() = 'service_role');

-- candles_30m: SELECT public, INSERT/UPDATE/DELETE service_role
CREATE POLICY select_all ON public.brvm_intraday_candles_30m FOR SELECT USING (true);
CREATE POLICY insert_service_role ON public.brvm_intraday_candles_30m FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY update_service_role ON public.brvm_intraday_candles_30m FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY delete_service_role ON public.brvm_intraday_candles_30m FOR DELETE USING (auth.role() = 'service_role');

-- patterns_raw: SELECT public, INSERT/UPDATE service_role
CREATE POLICY select_all ON public.brvm_intraday_patterns_raw FOR SELECT USING (true);
CREATE POLICY insert_service_role ON public.brvm_intraday_patterns_raw FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY update_service_role ON public.brvm_intraday_patterns_raw FOR UPDATE USING (auth.role() = 'service_role');

-- patterns: SELECT public, INSERT/UPDATE service_role
CREATE POLICY select_all ON public.brvm_intraday_patterns FOR SELECT USING (true);
CREATE POLICY insert_service_role ON public.brvm_intraday_patterns FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY update_service_role ON public.brvm_intraday_patterns FOR UPDATE USING (auth.role() = 'service_role');

-- pattern_scores: SELECT public, INSERT/UPDATE service_role
CREATE POLICY select_all ON public.brvm_pattern_scores FOR SELECT USING (true);
CREATE POLICY insert_service_role ON public.brvm_pattern_scores FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY update_service_role ON public.brvm_pattern_scores FOR UPDATE USING (auth.role() = 'service_role');

-- job_runs: SELECT public, INSERT/UPDATE/DELETE service_role
CREATE POLICY select_all ON public.brvm_intraday_job_runs FOR SELECT USING (true);
CREATE POLICY insert_service_role ON public.brvm_intraday_job_runs FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY update_service_role ON public.brvm_intraday_job_runs FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY delete_service_role ON public.brvm_intraday_job_runs FOR DELETE USING (auth.role() = 'service_role');

-- integrity_checks: SELECT public, INSERT/DELETE service_role
CREATE POLICY select_all ON public.brvm_intraday_integrity_checks FOR SELECT USING (true);
CREATE POLICY insert_service_role ON public.brvm_intraday_integrity_checks FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY delete_service_role ON public.brvm_intraday_integrity_checks FOR DELETE USING (auth.role() = 'service_role');

-- pattern_errors: SELECT public, INSERT service_role
CREATE POLICY select_all ON public.brvm_pattern_errors FOR SELECT USING (true);
CREATE POLICY insert_service_role ON public.brvm_pattern_errors FOR INSERT WITH CHECK (auth.role() = 'service_role');
```

- [ ] **Step 2: Apply RLS migration**

```bash
npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0042_intraday_patterns_rls.sql
git commit -m "schema(patterns): add RLS policies for pattern tables"
```

---

### Task 3: Create TypeScript Types & Database Helpers

**Files:**
- Create: `frontend/lib/patterns/types.ts`
- Create: `frontend/lib/patterns/db-helpers.ts`
- Create: `frontend/lib/patterns/database.ts`

- [ ] **Step 1: Write TypeScript enums and type constants**

Create `frontend/lib/patterns/types.ts`:

```typescript
// Enums & Type Constants
export const JOB_STATUS = {
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PARTIAL: 'PARTIAL',
  SUPERSEDED: 'SUPERSEDED',
} as const;
export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS];

export const PIPELINE_PHASE = {
  INTEGRITY_CHECK: 'integrity_check',
  RECONSTRUCT: 'reconstruct',
  DETECT_RAW: 'detect_raw',
  QUALIFY: 'qualify',
  AGGREGATE: 'aggregate',
} as const;
export type PipelinePhase = typeof PIPELINE_PHASE[keyof typeof PIPELINE_PHASE];

export const PATTERN_TYPE = {
  ATR_EXTREME: 'atr_extreme',
  BULLISH_CONSOLIDATION: 'bullish_consolidation',
} as const;
export type PatternType = typeof PATTERN_TYPE[keyof typeof PATTERN_TYPE];

export const TIMEFRAME = {
  TF_15M: '15m',
  TF_30M: '30m',
} as const;
export type Timeframe = typeof TIMEFRAME[keyof typeof TIMEFRAME];

export const CONFIDENCE_LEVEL = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;
export type ConfidenceLevel = typeof CONFIDENCE_LEVEL[keyof typeof CONFIDENCE_LEVEL];

export const VALIDATION_STATUS = {
  VALID: 'VALID',
  QUESTIONABLE: 'QUESTIONABLE',
  INVALID: 'INVALID',
} as const;
export type ValidationStatus = typeof VALIDATION_STATUS[keyof typeof VALIDATION_STATUS];

export const INTEGRITY_STATUS = {
  PASS: 'PASS',
  WARN: 'WARN',
  FAIL: 'FAIL',
} as const;
export type IntegrityStatus = typeof INTEGRITY_STATUS[keyof typeof INTEGRITY_STATUS];

export const INTEGRITY_CHECK_TYPE = {
  SNAPSHOT_COUNT: 'snapshot_count',
  TIMESTAMP_CONTINUITY: 'timestamp_continuity',
  MISSING_FIELDS: 'missing_fields',
  VOLUME_PLAUSIBILITY: 'volume_plausibility',
} as const;
export type IntegrityCheckType = typeof INTEGRITY_CHECK_TYPE[keyof typeof INTEGRITY_CHECK_TYPE];
```

- [ ] **Step 2: Write database helper functions**

Create `frontend/lib/patterns/db-helpers.ts`:

```typescript
/**
 * Normalize a Date to 'YYYY-MM-DD' string for Supabase
 */
export function toDateOnly(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Convert ISO datetime string to Date object
 */
export function toDate(isoString: string): Date {
  return new Date(isoString);
}
```

- [ ] **Step 3: Write database entity interfaces**

Create `frontend/lib/patterns/database.ts`:

```typescript
import {
  PATTERN_TYPE,
  Timeframe,
  CONFIDENCE_LEVEL,
  VALIDATION_STATUS,
  JOB_STATUS,
  ConfidenceLevel,
  ValidationStatus,
  JobStatus,
  PipelinePhase,
} from './types.js';

export interface IntraDayCandle {
  id?: number;
  code: string;
  date_marche: Date;
  time_start: Date;
  time_end: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // NOT bigint
  sample_count: number;
  quality_score: number; // 0.0–1.0
  is_complete: boolean;
  is_synthetic: boolean;
  source: string;
  engine_version: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface PatternRaw {
  id?: number;
  code: string;
  date_marche: Date;
  pattern_type: typeof PATTERN_TYPE[keyof typeof PATTERN_TYPE];
  timeframe: Timeframe;
  candle_start_time: Date;
  candle_end_time: Date;
  detected_at: Date;
  value: number;
  threshold: number;
  is_triggered: boolean;
  metadata: Record<string, any>;
  engine_version: string;
  rules_version: string;
  created_at?: Date;
}

export interface Pattern extends PatternRaw {
  quality_score: number;
  confidence_level: ConfidenceLevel;
  associated_news_count: number;
  associated_news_ids?: string[];
  has_fundamental_trigger: boolean;
  validation_status: ValidationStatus;
  explanation_fr: string;
  updated_at?: Date;
}

export interface PatternScore {
  id?: number;
  code: string;
  date_marche: Date;
  atr_score: number;
  atr_confidence: ConfidenceLevel;
  atr_explanation_fr: string;
  consolidation_score: number;
  consolidation_confidence: ConfidenceLevel;
  consolidation_explanation_fr: string;
  overall_confidence: ConfidenceLevel;
  combined_pattern_score: number;
  patterns_detected_count: number;
  patterns_with_news_count: number;
  advisor_impact_estimate: number;
  advisor_sub_score_delta: number; // [-5…+5]
  engine_version: string;
  rules_version: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface JobRun {
  id?: number;
  date_marche: Date;
  phase: PipelinePhase;
  job_name: string;
  status: JobStatus;
  started_at: Date;
  finished_at?: Date;
  duration_ms?: number;
  rows_in?: number;
  rows_out?: number;
  errors_count: number;
  warnings_count: number;
  metadata?: Record<string, any>;
  created_at?: Date;
}

export interface PatternEngineConfig {
  id?: number;
  engine_version: string;
  rules_version: string;
  atr_period: number;
  atr_multiplier: number;
  min_snapshots_for_complete: number;
  min_quality_score_for_valid: number;
  consolidation_min_bars: number;
  consolidation_max_body_ratio: number;
  metadata?: Record<string, any>;
  is_active: boolean;
  created_at?: Date;
}
```

- [ ] **Step 4: Run TypeScript typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/patterns/types.ts frontend/lib/patterns/db-helpers.ts frontend/lib/patterns/database.ts
git commit -m "feat(patterns): add TypeScript types and database interfaces"
```

---

### Task 4: Create Partition Management Script

**Files:**
- Create: `supabase/scripts/create_partitions.sql`

- [ ] **Step 1: Write partition creation script**

Create `supabase/scripts/create_partitions.sql`:

```sql
-- Script to create monthly partitions for pattern tables
-- Run this on day 25 of each month before next month's inserts occur

-- Helper: Create partition if not exists (PostgreSQL 14+)
-- For earlier versions, use CREATE TABLE IF NOT EXISTS

-- candles_15m: Create next 2 months
CREATE TABLE IF NOT EXISTS public.brvm_intraday_candles_15m_2026_10 PARTITION OF public.brvm_intraday_candles_15m
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS public.brvm_intraday_candles_15m_2026_11 PARTITION OF public.brvm_intraday_candles_15m
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

-- candles_30m: Create next 2 months
CREATE TABLE IF NOT EXISTS public.brvm_intraday_candles_30m_2026_10 PARTITION OF public.brvm_intraday_candles_30m
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS public.brvm_intraday_candles_30m_2026_11 PARTITION OF public.brvm_intraday_candles_30m
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

-- patterns_raw: Create next 2 months
CREATE TABLE IF NOT EXISTS public.brvm_intraday_patterns_raw_2026_10 PARTITION OF public.brvm_intraday_patterns_raw
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS public.brvm_intraday_patterns_raw_2026_11 PARTITION OF public.brvm_intraday_patterns_raw
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

-- patterns: Create next 2 months
CREATE TABLE IF NOT EXISTS public.brvm_intraday_patterns_2026_10 PARTITION OF public.brvm_intraday_patterns
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS public.brvm_intraday_patterns_2026_11 PARTITION OF public.brvm_intraday_patterns
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
```

Documentation: Add to `docs/DEPLOYMENT.md`:

```markdown
## Monthly Partition Management

Every 25th of the month, run `supabase/scripts/create_partitions.sql` via:
```bash
psql -h <SUPABASE_HOST> -U postgres -d postgres -f supabase/scripts/create_partitions.sql
```

Or via GitHub Actions cron job (optional, future enhancement).
```

- [ ] **Step 2: Commit**

```bash
git add supabase/scripts/create_partitions.sql docs/DEPLOYMENT.md
git commit -m "ops(patterns): add monthly partition creation script"
```

---

### Task 5: Seed Initial Engine Config

**Files:**
- Create: `supabase/scripts/seed_engine_config.sql`

- [ ] **Step 1: Write seed script**

Create `supabase/scripts/seed_engine_config.sql`:

```sql
-- Seed initial engine configuration
INSERT INTO public.brvm_pattern_engine_config (
  engine_version, rules_version,
  atr_period, atr_multiplier,
  min_snapshots_for_complete, min_quality_score_for_valid,
  consolidation_min_bars, consolidation_max_body_ratio,
  metadata, is_active
) VALUES (
  '1.0.0', 'rules_2026_v1',
  14, 3.0,
  4, 0.5,
  3, 0.3,
  '{"author": "pattern-engine-v1", "description": "Initial production configuration"}'::jsonb,
  true
) ON CONFLICT (engine_version) DO NOTHING;
```

- [ ] **Step 2: Execute seed**

```bash
psql -h <SUPABASE_HOST> -U postgres -d postgres -f supabase/scripts/seed_engine_config.sql
```

- [ ] **Step 3: Verify in Supabase**

Query: `SELECT * FROM brvm_pattern_engine_config WHERE is_active = true`  
Expected: One row with engine_version = '1.0.0'.

- [ ] **Step 4: Commit**

```bash
git add supabase/scripts/seed_engine_config.sql
git commit -m "ops(patterns): seed initial engine configuration v1.0.0"
```

---

## Phase 2: Core Pipeline (10 tasks)

### Task 6: Implement Candle Reconstruction Logic

**Files:**
- Create: `scraper/src/lib/patterns/reconstruction.ts`
- Create: `scraper/src/tests/patterns.reconstruction.test.ts`

- [ ] **Step 1: Write test for 15m reconstruction**

Create `scraper/src/tests/patterns.reconstruction.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { reconstructCandles15mForDay } from '../lib/patterns/reconstruction.js';
import type { IntraDaySnapshot, IntraDayCandle } from '../lib/patterns/database.js';

describe('reconstructCandles15mForDay', () => {
  it('should reconstruct 15m candles from snapshots', () => {
    const snapshots: IntraDaySnapshot[] = [
      {
        code: 'PALC',
        timestamp: new Date('2026-07-07T09:45:00Z'),
        cours_jour: 100,
        volume: 1000,
        source: 'brvm_public',
        is_reliable: true,
      },
      {
        code: 'PALC',
        timestamp: new Date('2026-07-07T09:50:00Z'),
        cours_jour: 102,
        volume: 500,
        source: 'brvm_public',
        is_reliable: true,
      },
      {
        code: 'PALC',
        timestamp: new Date('2026-07-07T09:55:00Z'),
        cours_jour: 101,
        volume: 800,
        source: 'brvm_public',
        is_reliable: true,
      },
      {
        code: 'PALC',
        timestamp: new Date('2026-07-07T10:00:00Z'),
        cours_jour: 103,
        volume: 600,
        source: 'brvm_public',
        is_reliable: true,
      },
    ];

    const config = {
      min_snapshots_for_complete: 4,
      min_quality_threshold: 0.5,
      engine_version: '1.0.0',
    };

    const date_marche = new Date('2026-07-07');
    const candles = reconstructCandles15mForDay('PALC', date_marche, snapshots, config);

    expect(candles).toHaveLength(1);
    const candle = candles[0];
    expect(candle.code).toBe('PALC');
    expect(candle.open).toBe(100);
    expect(candle.high).toBe(103);
    expect(candle.low).toBe(100);
    expect(candle.close).toBe(103);
    expect(candle.volume).toBe(2900);
    expect(candle.sample_count).toBe(4);
    expect(candle.is_complete).toBe(true);
    expect(candle.quality_score).toBe(1.0);
  });
});
```

- [ ] **Step 2: Implement reconstruction function**

Create `scraper/src/lib/patterns/reconstruction.ts`:

```typescript
import type { IntraDaySnapshot, IntraDayCandle } from './database.js';

export interface ReconstructionConfig {
  min_snapshots_for_complete: number;
  min_quality_threshold: number;
  engine_version: string;
}

function groupByWindow(
  snapshots: IntraDaySnapshot[],
  windowMinutes: 15 | 30
): Map<string, IntraDaySnapshot[]> {
  const grouped = new Map<string, IntraDaySnapshot[]>();

  for (const snap of snapshots) {
    const minutes = Math.floor(snap.timestamp.getUTCMinutes() / windowMinutes) * windowMinutes;
    const windowStart = new Date(snap.timestamp);
    windowStart.setUTCMinutes(minutes, 0, 0);
    
    const key = windowStart.toISOString();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(snap);
  }

  return grouped;
}

function reconstructCandle15m(
  code: string,
  date_marche: Date,
  windowStart: Date,
  snapshots: IntraDaySnapshot[],
  config: ReconstructionConfig
): IntraDayCandle | null {
  if (snapshots.length === 0) return null;

  snapshots.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const prices = snapshots.map(s => s.cours_jour);
  const volumes = snapshots.map(s => s.volume);

  const open = prices[0];
  const close = prices[prices.length - 1];
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const volume = volumes.reduce((a, b) => a + b, 0);

  const windowEnd = new Date(windowStart);
  windowEnd.setUTCMinutes(windowEnd.getUTCMinutes() + 15);

  const is_complete = snapshots.length >= config.min_snapshots_for_complete;
  const quality_score = Math.min(1.0, snapshots.length / config.min_snapshots_for_complete);

  return {
    code,
    date_marche,
    time_start: windowStart,
    time_end: windowEnd,
    open,
    high,
    low,
    close,
    volume,
    sample_count: snapshots.length,
    quality_score,
    is_complete,
    is_synthetic: true,
    source: 'brvm_public_snapshot',
    engine_version: config.engine_version,
  };
}

export function reconstructCandles15mForDay(
  code: string,
  date_marche: Date,
  snapshots: IntraDaySnapshot[],
  config: ReconstructionConfig
): IntraDayCandle[] {
  const codeSnapshots = snapshots.filter(s => s.code === code);
  if (codeSnapshots.length === 0) return [];

  const grouped = groupByWindow(codeSnapshots, 15);
  
  const candles: IntraDayCandle[] = [];
  for (const [windowKey, snaps] of grouped.entries()) {
    const windowStart = new Date(windowKey);
    const candle = reconstructCandle15m(code, date_marche, windowStart, snaps, config);
    if (candle) candles.push(candle);
  }

  return candles.sort((a, b) => a.time_start.getTime() - b.time_start.getTime());
}

export function deriveCandles30mFromCandles15m(
  candles15m: IntraDayCandle[],
  config: ReconstructionConfig
): IntraDayCandle[] {
  const grouped = new Map<string, IntraDayCandle[]>();

  for (const candle of candles15m) {
    const minutes = Math.floor(candle.time_start.getUTCMinutes() / 30) * 30;
    const windowStart = new Date(candle.time_start);
    windowStart.setUTCMinutes(minutes, 0, 0);
    
    const key = windowStart.toISOString();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(candle);
  }

  const candles30m: IntraDayCandle[] = [];
  for (const [windowKey, candles] of grouped.entries()) {
    if (candles.length === 0) continue;

    const windowStart = new Date(windowKey);
    const windowEnd = new Date(windowStart);
    windowEnd.setUTCMinutes(windowEnd.getUTCMinutes() + 30);

    const opens = candles.map(c => c.open);
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    const candle30m: IntraDayCandle = {
      code: candles[0].code,
      date_marche: candles[0].date_marche,
      time_start: windowStart,
      time_end: windowEnd,
      open: opens[0],
      close: closes[closes.length - 1],
      high: Math.max(...highs),
      low: Math.min(...lows),
      volume: volumes.reduce((a, b) => a + b, 0),
      sample_count: candles.reduce((sum, c) => sum + c.sample_count, 0),
      quality_score: Math.min(...candles.map(c => c.quality_score)),
      is_complete: candles.every(c => c.is_complete),
      is_synthetic: true,
      source: 'brvm_intraday_candles_15m_aggregated',
      engine_version: config.engine_version,
    };

    candles30m.push(candle30m);
  }

  return candles30m.sort((a, b) => a.time_start.getTime() - b.time_start.getTime());
}
```

- [ ] **Step 3: Run tests**

```bash
cd scraper && npm test -- patterns.reconstruction.test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add scraper/src/lib/patterns/reconstruction.ts scraper/src/tests/patterns.reconstruction.test.ts
git commit -m "feat(patterns): add candle reconstruction from snapshots with tests"
```

---

### Task 7: Implement ATR Indicator & Volatility Detection

**Files:**
- Create: `scraper/src/lib/patterns/indicators/atr.ts`
- Create: `scraper/src/tests/patterns.atr.test.ts`

- [ ] **Step 1: Write test for ATR calculation**

Create `scraper/src/tests/patterns.atr.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateATR, detectExtremeVolatility } from '../lib/patterns/indicators/atr.js';
import type { IntraDayCandle } from '../lib/patterns/database.js';

describe('calculateATR', () => {
  it('should calculate ATR for a series of candles', () => {
    const candles: IntraDayCandle[] = Array.from({ length: 14 }, (_, i) => ({
      code: 'PALC',
      date_marche: new Date('2026-07-07'),
      time_start: new Date(`2026-07-07T${String(9 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}:00Z`),
      time_end: new Date(`2026-07-07T${String(9 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15 + 15).padStart(2, '0')}:00Z`),
      open: 100 + i,
      high: 105 + i,
      low: 98 + i,
      close: 102 + i,
      volume: 1000,
      sample_count: 4,
      quality_score: 1.0,
      is_complete: true,
      is_synthetic: true,
      source: 'test',
      engine_version: '1.0.0',
    }));

    const result = calculateATR(candles, 14);
    expect(result.atr).toBeGreaterThan(0);
    expect(result.tr_values).toHaveLength(14);
  });
});

describe('detectExtremeVolatility', () => {
  it('should detect extreme volatility', () => {
    const candles: IntraDayCandle[] = Array.from({ length: 15 }, (_, i) => ({
      code: 'CRNX',
      date_marche: new Date('2026-07-07'),
      time_start: new Date(`2026-07-07T${String(9 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}:00Z`),
      time_end: new Date(`2026-07-07T${String(9 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15 + 15).padStart(2, '0')}:00Z`),
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 1000,
      sample_count: 4,
      quality_score: 1.0,
      is_complete: true,
      is_synthetic: true,
      source: 'test',
      engine_version: '1.0.0',
    }));

    // Last candle: extreme range
    candles[14].high = 120;
    candles[14].low = 80;
    candles[14].open = 85;
    candles[14].close = 115;

    const detection = detectExtremeVolatility(candles, { atr_period: 14, atr_multiplier: 3.0 });
    expect(detection.is_triggered).toBe(true);
    expect(detection.atr).toBeGreaterThan(0);
    expect(detection.ratio).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Implement ATR functions**

Create `scraper/src/lib/patterns/indicators/atr.ts`:

```typescript
import type { IntraDayCandle } from '../database.js';

export interface ATRResult {
  atr: number;
  tr_values: number[];
}

export interface ExtremeVolatilityDetection {
  is_triggered: boolean;
  atr: number;
  range: number;
  ratio: number;
  threshold: number;
  confidence: number;
}

export interface ExtremeVolatilityParams {
  atr_period?: number;
  atr_multiplier?: number;
  min_candles?: number;
}

function calculateTrueRange(high: number, low: number, prevClose: number | null): number {
  if (prevClose === null) {
    return high - low;
  }
  return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
}

export function calculateATR(candles: IntraDayCandle[], period: number = 14): ATRResult {
  if (candles.length < period) {
    throw new Error(`Need at least ${period} candles for ATR(${period})`);
  }

  const trValues: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    const prevClose = i === 0 ? null : candles[i - 1].close;
    const tr = calculateTrueRange(candles[i].high, candles[i].low, prevClose);
    trValues.push(tr);
  }

  const recentTR = trValues.slice(-period);
  const atr = recentTR.reduce((a, b) => a + b, 0) / period;

  return { atr, tr_values: trValues };
}

export function detectExtremeVolatility(
  candles: IntraDayCandle[],
  params: ExtremeVolatilityParams = {}
): ExtremeVolatilityDetection {
  const period = params.atr_period ?? 14;
  const multiplier = params.atr_multiplier ?? 3.0;
  const minCandles = params.min_candles ?? period;

  if (candles.length < minCandles) {
    return {
      is_triggered: false,
      atr: 0,
      range: 0,
      ratio: 0,
      threshold: 0,
      confidence: 0.0,
    };
  }

  const atrResult = calculateATR(candles, period);
  const atr = atrResult.atr;
  const lastCandle = candles[candles.length - 1];
  const range = lastCandle.high - lastCandle.low;
  const threshold = atr * multiplier;

  const avgQuality = 
    candles.slice(-period).reduce((sum, c) => sum + c.quality_score, 0) / period;

  return {
    is_triggered: range > threshold,
    atr,
    range,
    ratio: atr > 0 ? range / atr : 0,
    threshold,
    confidence: avgQuality,
  };
}
```

- [ ] **Step 3: Run tests**

```bash
cd scraper && npm test -- patterns.atr.test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add scraper/src/lib/patterns/indicators/atr.ts scraper/src/tests/patterns.atr.test.ts
git commit -m "feat(patterns): add ATR calculation and extreme volatility detection with tests"
```

---

### Task 8: Implement Bullish Consolidation Detection

**Files:**
- Create: `scraper/src/lib/patterns/indicators/consolidation.ts`
- Create: `scraper/src/tests/patterns.consolidation.test.ts`

- [ ] **Step 1: Write test for consolidation detection**

Create `scraper/src/tests/patterns.consolidation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { detectBullishConsolidation } from '../lib/patterns/indicators/consolidation.js';
import type { IntraDayCandle } from '../lib/patterns/database.js';

describe('detectBullishConsolidation', () => {
  it('should detect bullish consolidation after impulse', () => {
    const candles: IntraDayCandle[] = [
      // Normal candles
      ...Array.from({ length: 3 }, (_, i) => ({
        code: 'LHSW',
        date_marche: new Date('2026-07-07'),
        time_start: new Date(`2026-07-07T${String(9 + i).padStart(2, '0')}:00:00Z`),
        time_end: new Date(`2026-07-07T${String(9 + i).padStart(2, '0')}:15:00Z`),
        open: 100,
        high: 102,
        low: 98,
        close: 101,
        volume: 1000,
        sample_count: 4,
        quality_score: 1.0,
        is_complete: true,
        is_synthetic: true,
        source: 'test',
        engine_version: '1.0.0',
      })),
      // Impulse: large body, high volume
      {
        code: 'LHSW',
        date_marche: new Date('2026-07-07'),
        time_start: new Date('2026-07-07T12:00:00Z'),
        time_end: new Date('2026-07-07T12:15:00Z'),
        open: 101,
        high: 112,
        low: 100,
        close: 110,
        volume: 5000,
        sample_count: 4,
        quality_score: 1.0,
        is_complete: true,
        is_synthetic: true,
        source: 'test',
        engine_version: '1.0.0',
      },
      // Consolidation: small body, stays above impulse open
      ...Array.from({ length: 3 }, (_, i) => ({
        code: 'LHSW',
        date_marche: new Date('2026-07-07'),
        time_start: new Date(`2026-07-07T${String(12 + Math.floor((i + 1) / 4)).padStart(2, '0')}:${String(((i + 1) % 4) * 15).padStart(2, '0')}:00Z`),
        time_end: new Date(`2026-07-07T${String(12 + Math.floor((i + 1) / 4)).padStart(2, '0')}:${String(((i + 1) % 4) * 15 + 15).padStart(2, '0')}:00Z`),
        open: 108 + i,
        high: 110 + i,
        low: 107 + i,
        close: 109 + i,
        volume: 800,
        sample_count: 4,
        quality_score: 1.0,
        is_complete: true,
        is_synthetic: true,
        source: 'test',
        engine_version: '1.0.0',
      })),
    ];

    const detection = detectBullishConsolidation(candles, {
      min_bars_after_impulse: 3,
      max_body_ratio: 0.3,
    });

    expect(detection.is_triggered).toBe(true);
    expect(detection.impulse_candle_idx).toBe(3);
    expect(detection.consolidation_bars).toBe(3);
  });
});
```

- [ ] **Step 2: Implement consolidation detection**

Create `scraper/src/lib/patterns/indicators/consolidation.ts`:

```typescript
import type { IntraDayCandle } from '../database.js';

export interface BullishConsolidationDetection {
  is_triggered: boolean;
  impulse_candle_idx: number;
  consolidation_bars: number;
  avg_body_ratio: number;
  volume_quality: number;
  confidence: number;
}

export interface BullishConsolidationParams {
  min_bars_after_impulse?: number;
  max_body_ratio?: number;
  min_volume_ratio?: number;
}

function isImpulsionCandle(
  candle: IntraDayCandle,
  avgBodyRatio: number,
  avgVolume: number
): boolean {
  const bodySize = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  const bodyRatio = range > 0 ? bodySize / range : 0;

  return bodyRatio > avgBodyRatio * 1.5 && candle.volume > avgVolume * 1.2;
}

export function detectBullishConsolidation(
  candles: IntraDayCandle[],
  params: BullishConsolidationParams = {}
): BullishConsolidationDetection {
  const minBarsAfterImpulse = params.min_bars_after_impulse ?? 3;
  const maxBodyRatio = params.max_body_ratio ?? 0.3;
  const minVolumeRatio = params.min_volume_ratio ?? 0.7;

  if (candles.length < minBarsAfterImpulse + 1) {
    return {
      is_triggered: false,
      impulse_candle_idx: -1,
      consolidation_bars: 0,
      avg_body_ratio: 0,
      volume_quality: 0,
      confidence: 0.0,
    };
  }

  const avgBodyRatio = 
    candles.reduce((sum, c) => {
      const bodySize = Math.abs(c.close - c.open);
      const range = c.high - c.low;
      return sum + (range > 0 ? bodySize / range : 0);
    }, 0) / candles.length;

  const avgVolume = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;

  let lastImpulsionIdx = -1;
  for (let i = candles.length - 1; i >= 0; i--) {
    if (isImpulsionCandle(candles[i], avgBodyRatio, avgVolume)) {
      lastImpulsionIdx = i;
      break;
    }
  }

  if (lastImpulsionIdx === -1 || lastImpulsionIdx === candles.length - 1) {
    return {
      is_triggered: false,
      impulse_candle_idx: -1,
      consolidation_bars: 0,
      avg_body_ratio: 0,
      volume_quality: 0,
      confidence: 0.0,
    };
  }

  const consolidationCandles = candles.slice(lastImpulsionIdx + 1);
  const impulseCandle = candles[lastImpulsionIdx];

  let consolidationValid = true;
  let totalBodyRatio = 0;
  let totalVolume = 0;

  for (const candle of consolidationCandles) {
    const bodySize = Math.abs(candle.close - candle.open);
    const range = candle.high - candle.low;
    const bodyRatio = range > 0 ? bodySize / range : 0;

    if (bodyRatio > maxBodyRatio || candle.close <= impulseCandle.open) {
      consolidationValid = false;
      break;
    }

    totalBodyRatio += bodyRatio;
    totalVolume += candle.volume;
  }

  const avgConsolidationBodyRatio = 
    consolidationCandles.length > 0 ? totalBodyRatio / consolidationCandles.length : 0;
  const avgConsolidationVolume = 
    consolidationCandles.length > 0 ? totalVolume / consolidationCandles.length : 0;

  const volumeQuality = impulseCandle.volume > 0 ? avgConsolidationVolume / impulseCandle.volume : 0;

  const is_triggered = 
    consolidationValid &&
    consolidationCandles.length >= minBarsAfterImpulse &&
    volumeQuality >= minVolumeRatio;

  const avgQuality = 
    consolidationCandles.reduce((sum, c) => sum + c.quality_score, 0) / (consolidationCandles.length || 1);

  return {
    is_triggered,
    impulse_candle_idx: lastImpulsionIdx,
    consolidation_bars: consolidationCandles.length,
    avg_body_ratio: avgConsolidationBodyRatio,
    volume_quality: volumeQuality,
    confidence: avgQuality,
  };
}
```

- [ ] **Step 3: Run tests**

```bash
cd scraper && npm test -- patterns.consolidation.test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add scraper/src/lib/patterns/indicators/consolidation.ts scraper/src/tests/patterns.consolidation.test.ts
git commit -m "feat(patterns): add bullish consolidation detection with tests"
```

---

*(Due to length constraints, the remaining 7 tasks from Phase 2 (Upsert Functions, PHASE 3A/3B/4 Orchestration) and all of Phase 3 & 4 tasks will follow the same TDD structure. I'll provide a condensed outline below, then you can request expansion of specific tasks if needed.)*

---

## Phase 2 Remaining Tasks (Summary)

**Task 9: Implement Upsert Functions (DB Operations)**
- Files: `frontend/lib/db/upsert.ts`
- Tests: Verify idempotence with composite keys, no duplicates on rerun

**Task 10: Implement PHASE 3A Raw Detection Orchestration**
- Files: `scraper/src/lib/patterns/phase-detect-raw.ts`
- Tests: Verify ATR + consolidation patterns are stored in patterns_raw

**Task 11: Implement PHASE 3B Qualification (News Association)**
- Files: `scraper/src/lib/patterns/phase-qualify.ts`
- Tests: Verify news lookup, confidence_level assignment, overall_confidence calculation

**Task 12: Implement PHASE 4 Aggregation & Advisor Scoring**
- Files: `scraper/src/lib/patterns/phase-aggregate.ts`
- Tests: Verify advisor_sub_score_delta calculation (-5 to +5 range)

**Task 13: Implement Job Run Logging & Error Tracking**
- Files: `scraper/src/lib/db/errors.ts`
- Tests: Verify job_runs and pattern_errors tables are populated correctly

**Task 14: Implement Full Batch Orchestration Command**
- Files: `scraper/src/commands/patterns-batch.ts`
- Tests: End-to-end: snapshots → reconstruction → detect → qualify → aggregate

**Task 15: Add Unit & Integration Tests for Pipeline**
- Files: `scraper/src/tests/patterns.pipeline.integration.test.ts`
- Tests: Full workflow from fake snapshots to pattern_scores

---

## Phase 3: Frontend Integration (4 tasks)

**Task 16: Implement Advisor Enrichment Function**
- Create: `frontend/lib/advisor/integrate-patterns.ts`
- Tests: Verify enrichAdvisorRecommendation applies delta conditionally

**Task 17: Create Intraday Patterns Screener Page**
- Create: `frontend/app/screener/intraday-patterns/page.tsx`
- Tests: Verify page renders patterns, filters work, sorting by advisor_sub_score_delta

**Task 18: Add Behavioral Patterns Section to Diagnostic IA**
- Modify: `frontend/app/premium/diagnostic/[code]/page.tsx`
- Tests: Verify "Recent Behavioral Patterns" section renders and explains patterns

**Task 19: Update Advisor/Dashboard to Use Pattern Scores**
- Modify: `frontend/app/dashboard/page.tsx`
- Tests: Verify Conseiller applies pattern delta conditionally on threshold

---

## Phase 4: Tests & Deployment (3 tasks)

**Task 20: Create GitHub Actions Workflow for Daily Batch**
- Create: `.github/workflows/patterns-daily.yml`
- Tests: Verify workflow triggers at 15:15 UTC Mon-Fri

**Task 21: Create Monitoring Dashboard (Admin)**
- Create: `frontend/app/admin/scraping/page.tsx`
- Tests: Verify metrics, runs, and error feed display

**Task 22: Document Deployment & Operations**
- Update: `docs/DEPLOYMENT.md` with partition creation, cron setup, alert configuration

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-07-intraday-patterns-implementation.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session, batch execution with checkpoints

**Which approach?**
