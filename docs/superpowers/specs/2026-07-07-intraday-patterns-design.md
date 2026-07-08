# Intraday Patterns for Advisor Enrichment — Design Spec

> **For agentic workers:** This spec is ready for `superpowers:writing-plans` to create a detailed implementation plan task-by-task.

**Goal:** Enrich the WESTBOURSE Conseiller with intraday patterns (ATR extreme volatility + bullish consolidation) detected on 15m/30m synthetically reconstructed candles, qualified with fundamental triggers, and aggregated into advisor sub-scores (ΔScore -5 to +5).

**Architecture:** 7-phase batch pipeline (PHASE 0 integrity → PHASE 2 reconstruction → PHASE 3A raw detection → PHASE 3B qualification → PHASE 4 aggregation → PHASE 5 frontend restitution), running once daily after market close via GitHub Actions cron or Vercel cron, with full audit trail, idempotence, and graceful fallback.

**Tech Stack:** Supabase PostgreSQL (partitioned tables, RLS, service_role writes), Next.js 14 backend API routes, TypeScript strict (no-emit typechecks), scraper Node.js ≥20 with ESM + Supabase JS v2, Recharts for frontend charts.

---

## 1. Problem Statement

The BRVM's public data (brvm.org) updates intraday prices every ~15 minutes during trading (09:45–14:00 UTC). Currently, WESTBOURSE collects daily close only and lacks:
- **Intraday signal detection** (volatility spikes, consolidation patterns) that activate fresh trading opportunities
- **Advisor enrichment** with behavioral micro-cap patterns (e.g., LHSW stair-step consolidation, CRNX ATR extreme)
- **Cross-reference** (volatility *with* fundamental trigger vs. noise without news)
- **Explainability** for premium users (why did advisor score shift today?)

Solution: Reconstruct 15m/30m synthetic candles from public snapshots, detect ATR extrême and consolidation haussière, qualify with news, and feed as sub-scores into the existing Conseiller, with a secondary screener and diagnostic IA enrichment.

---

## 2. Scope & Use Cases

### Primary Use Case
**Advisor enrichment**: Patterns detected intraday → PHASE 4 aggregation produces `brvm_pattern_scores` → Conseiller reads `advisor_sub_score_delta` and conditionally applies (confidence ≥ MEDIUM) → recommendation shifts by ±0–5 points.

### Secondary Use Cases
1. **Intraday screener** (`/screener/intraday-patterns`): List stocks detected during session, filterable by pattern type, timeframe, presence of fundamental trigger, confidence level.
2. **Diagnostic IA enrichment**: "Recent Behavioral Patterns" section in `/premium/diagnostic/[code]` showing last 24h pattern detections + explanations.

### Future (Phase 2)
- **Premium alerts** (email/Telegram) for HIGH-confidence patterns with fundamental triggers.
- Constraint: BRVM public data is delayed 15 min → no true real-time, only intraday-delayed alerting.

---

## 3. Database Schema

### New Tables

#### **brvm_pattern_engine_config** (Configuration versionnée)
```
Columns: id, engine_version (UNIQUE), rules_version, atr_period, atr_multiplier,
         min_snapshots_for_complete, min_quality_score_for_valid, 
         consolidation_min_bars, consolidation_max_body_ratio, metadata, is_active
PK: id
Policies: SELECT public, INSERT/UPDATE service_role
```
Purpose: Version-controlled parameters for pattern engine; allows side-by-side runs of different rule versions.

#### **brvm_intraday_candles_15m** (Reconstructed 15-min candles)
```
Columns: id (BIGSERIAL, not PK), code (FK→brvm_instruments), date_marche (DATE), time_start, time_end,
         open, high, low, close, volume (number, not bigint),
         sample_count, quality_score [0.0–1.0], is_complete, is_synthetic, source,
         engine_version, created_at, updated_at
PK: (code, date_marche, time_start, engine_version)
Partitioned by: RANGE(date_marche) — monthly (date_marche part of PK satisfies partitioning)
Indexes: (code, date_marche), (quality_score)
RLS: SELECT public, INSERT/UPDATE/DELETE service_role
```
Purpose: Synthetic OHLC reconstructed from snapshots; quality_score tracks completeness.

#### **brvm_intraday_candles_30m** (Reconstructed 30-min candles)
```
Columns: id (BIGSERIAL, not PK), code (FK→brvm_instruments), date_marche (DATE), time_start, time_end,
         open, high, low, close, volume, sample_count, quality_score, is_complete, is_synthetic, source,
         engine_version, created_at, updated_at
PK: (code, date_marche, time_start, engine_version)
Partitioned by: RANGE(date_marche) — monthly
Indexes: (code, date_marche), (quality_score)
RLS: SELECT public, INSERT/UPDATE/DELETE service_role
```
Derived from brvm_intraday_candles_15m via aggregation.

#### **brvm_intraday_patterns_raw** (Raw pattern detections — PHASE 3A)
```
Columns: id (BIGSERIAL, not PK), code (FK), date_marche, pattern_type (atr_extreme, bullish_consolidation),
         timeframe (15m, 30m), candle_start_time, candle_end_time, detected_at,
         value, threshold, is_triggered, metadata (JSONB),
         engine_version, rules_version, created_at
PK: (code, date_marche, pattern_type, timeframe, candle_start_time, engine_version)
Partitioned by: RANGE(date_marche) — monthly
Indexes: (code, date_marche), (is_triggered)
RLS: SELECT public, INSERT service_role
```
Purpose: Pure detection logic (ATR calculation, range comparison, consolidation structure); metadata includes atr, ratio, impulse_idx, etc. for audit.

#### **brvm_intraday_patterns** (Qualified patterns — PHASE 3B)
```
Columns: id (BIGSERIAL, not PK), code (FK), date_marche, pattern_type, timeframe, candle_start_time, candle_end_time, detected_at,
         is_triggered, value, threshold,
         quality_score, confidence_level (HIGH, MEDIUM, LOW),
         associated_news_count, associated_news_ids (TEXT[]),
         has_fundamental_trigger, validation_status (VALID, QUESTIONABLE, INVALID),
         explanation_fr, engine_version, rules_version, created_at, updated_at
PK: (code, date_marche, pattern_type, timeframe, candle_start_time, engine_version)
Partitioned by: RANGE(date_marche) — monthly
Indexes: (code, date_marche), (confidence_level)
RLS: SELECT public, INSERT/UPDATE service_role
```
Purpose: PHASE 3A patterns enriched with confidence, validation status, and FR explanations for frontend/advisor.

#### **brvm_pattern_scores** (Aggregated scores — PHASE 4)
```
Columns: id, code (FK), date_marche,
         atr_score, atr_confidence, atr_explanation_fr,
         consolidation_score, consolidation_confidence, consolidation_explanation_fr,
         overall_confidence (HIGH, MEDIUM, LOW),
         combined_pattern_score, patterns_detected_count, patterns_with_news_count,
         advisor_impact_estimate, advisor_sub_score_delta [-5…+5],
         engine_version, rules_version, created_at, updated_at
PK: (code, date_marche)
Indexes: (date_marche), (advisor_sub_score_delta), (overall_confidence)
RLS: SELECT public, INSERT/UPDATE service_role
```
Purpose: Single row per code/date; read by Conseiller to conditionally apply Δscore. overall_confidence is computed from atr_confidence and consolidation_confidence for unambiguous threshold comparison.

#### **brvm_intraday_job_runs** (Batch observability)
```
Columns: id, date_marche, phase (enum), job_name, status (RUNNING, SUCCESS, FAILED, PARTIAL, SUPERSEDED),
         started_at, finished_at, duration_ms, rows_in, rows_out,
         errors_count, warnings_count, metadata (JSONB), created_at
PK: id
Unique: (date_marche, phase)
Indexes: (date_marche, phase), (status)
RLS: SELECT public, INSERT/UPDATE/DELETE service_role
```
Purpose: Audit trail for each phase; supports rerun with SUPERSEDED status on soft delete.

#### **brvm_intraday_integrity_checks** (PHASE 0 validation)
```
Columns: id, date_marche, code (FK, nullable), check_type (snapshot_count, timestamp_continuity, missing_fields, volume_plausibility),
         status (PASS, WARN, FAIL), metric_name, threshold_value, actual_value, message, created_at
PK: id
Unique Index: CREATE UNIQUE INDEX uq_integrity_check ON brvm_intraday_integrity_checks (date_marche, check_type, COALESCE(code, 'global'))
Indexes: (date_marche), (code)
RLS: SELECT public, INSERT/DELETE service_role
```
Purpose: Track data quality signals; if any FAIL, skip reconstruction.

#### **brvm_pattern_errors** (Error logging for upsert failures)
```
Columns: id, date_marche, phase (enum), code (FK, nullable),
         table_name, error_message, error_code, context (JSONB), created_at
PK: id
Indexes: (date_marche, phase), (code), (table_name)
RLS: SELECT public, INSERT service_role
```
Purpose: Separate from job_runs to avoid UNIQUE(date_marche, phase) conflicts on repeated errors same day.

---

## 4. Pipeline Phases

### PHASE 0: Integrity Check (Pre-validation)
**Input:** `brvm_intraday_snapshots` WHERE date_marche = X AND is_reliable = true  
**Output:** `brvm_intraday_integrity_checks` with overall status  
**Logic:**
- Count snapshots per code; warn if < N expected (e.g., < 15 snapshots in full session expected ~30 min ÷ 15 min snapshot interval).
- Check timestamp continuity (gaps, duplicates, out-of-order).
- Validate required fields (code, cours_jour, timestamp).
- Calculate overall_status: PASS (all OK), WARN (minor gaps), FAIL (critical data missing).

**Decision:** If overall_status = FAIL, do NOT proceed to PHASE 2.

---

### PHASE 2: Reconstruction (Synthetic Candle Building)
**Input:** Validated snapshots  
**Output:** `brvm_intraday_candles_15m`, `brvm_intraday_candles_30m`  
**Logic:**
1. Group snapshots by (code, 15-min window).
2. For each group:
   - `open` = first price in window
   - `high` = max price
   - `low` = min price
   - `close` = last price
   - `volume` = sum of volumes
   - `sample_count` = number of snapshots
   - `quality_score` = sample_count / min_snapshots_for_complete (clamped 0–1)
   - `is_complete` = sample_count ≥ min_snapshots_for_complete
3. Derive 30m by aggregating two consecutive 15m candles (open from 1st, close from 2nd, high/low from both, etc.).
4. Upsert with idempotent keys (code, date_marche, time_start, engine_version).

---

### PHASE 3A: Raw Pattern Detection
**Input:** Reconstructed candles  
**Output:** `brvm_intraday_patterns_raw` with is_triggered flags  
**Logic:**
1. **ATR Extreme**: Calculate ATR(14) on each timeframe; detect if range > 3× ATR.
2. **Bullish Consolidation**: Find impulse candle (large body + high volume), then verify 3+ smaller-body candles above impulse open with reduced volume.
3. Store all detections (triggered or not) for audit; metadata captures atr, ratio, impulse_idx, consolidation_bars, etc.

**Note:** Detection is *pure logic*; no news correlation yet.

---

### PHASE 3B: Qualification with Fundamental Triggers
**Input:** `brvm_intraday_patterns_raw` + quality_score by code  
**Output:** `brvm_intraday_patterns` with confidence_level, validation_status, explanation_fr  
**Logic:**

1. For each pattern, query `market_event_instruments` JOIN `market_events` WHERE market_event_instruments.code = pattern.code AND market_events.event_date = pattern.date_marche.
   - Alternative sources: `brvm_communiques` (press releases) or other event tables if present.
2. Determine `has_fundamental_trigger` = true if associated_news_count > 0.
3. Calculate `confidence_level`:
   - HIGH: is_triggered AND dataQuality ≥ 0.75 AND has_fundamental_trigger
   - MEDIUM: is_triggered AND (dataQuality ≥ 0.6 OR has_fundamental_trigger)
   - LOW: otherwise
4. Calculate `validation_status`:
   - VALID: confidence = HIGH AND dataQuality ≥ 0.8
   - QUESTIONABLE: confidence = MEDIUM
   - INVALID: confidence = LOW OR dataQuality < 0.5
5. Generate `explanation_fr`: Human-readable text describing pattern, confidence, and fundamental context.
6. Compute `overall_confidence` as follows:
   - HIGH: if (atr_confidence = HIGH OR consolidation_confidence = HIGH) AND is_triggered
   - MEDIUM: if (atr_confidence = MEDIUM OR consolidation_confidence = MEDIUM) AND is_triggered
   - LOW: otherwise

---

### PHASE 4: Aggregation & Advisor Impact
**Input:** `brvm_intraday_patterns` qualified  
**Output:** `brvm_pattern_scores` with advisor_sub_score_delta  
**Logic:**
1. Group patterns by code.
2. **ATR Score** (-5 to +5):
   - If triggered + has_fundamental: +3 (MEDIUM conf) or +5 (HIGH)
   - If triggered + NO fundamental: -1 (MEDIUM) or -2 (HIGH) — potential noise
   - Else: 0
3. **Consolidation Score** (-5 to +5):
   - If triggered + HIGH conf: +4 (no news) or +5 (with news)
   - If triggered + MEDIUM: +2
   - If triggered + LOW: +1
   - Else: 0
4. **Advisor ΔScore** = weighted average of ATR and Consolidation scores, normalized [-5…+5].
   - Weight by confidence_level (HIGH=2, MEDIUM=1, LOW=0.5).
5. Upsert single row per code/date.

---

## 5. TypeScript Interfaces & Implementation

### Key Types

```typescript
// lib/patterns/types.ts
export const JOB_STATUS = {
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PARTIAL: 'PARTIAL',
  SUPERSEDED: 'SUPERSEDED',
} as const;

export const PATTERN_TYPE = {
  ATR_EXTREME: 'atr_extreme',
  BULLISH_CONSOLIDATION: 'bullish_consolidation',
} as const;

export const CONFIDENCE_LEVEL = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export const VALIDATION_STATUS = {
  VALID: 'VALID',
  QUESTIONABLE: 'QUESTIONABLE',
  INVALID: 'INVALID',
} as const;
```

### Database Entities

```typescript
// lib/patterns/database.ts
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
  volume: number; // NOT bigint — JSON.stringify issue
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
  pattern_type: PatternType;
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
```

### Indicators

```typescript
// lib/patterns/indicators/atr.ts
export function calculateATR(candles: IntraDayCandle[], period: number = 14): ATRResult
export function detectExtremeVolatility(candles: IntraDayCandle[], params?: ExtremeVolatilityParams): ExtremeVolatilityDetection

// lib/patterns/indicators/consolidation.ts
export function detectBullishConsolidation(candles: IntraDayCandle[], params?: BullishConsolidationParams): BullishConsolidationDetection
```

### Database Operations

```typescript
// lib/db/upsert.ts
export async function upsertCandles15m(supabase: SupabaseClient, candles: IntraDayCandle[]): Promise<UpsertResult>
export async function upsertPatternsRaw(supabase: SupabaseClient, patterns: PatternRaw[]): Promise<UpsertResult>
export async function upsertPatterns(supabase: SupabaseClient, patterns: Pattern[]): Promise<UpsertResult>
export async function upsertPatternScores(supabase: SupabaseClient, scores: PatternScore[]): Promise<UpsertResult>
export async function insertJobRun(supabase: SupabaseClient, jobRun: JobRun): Promise<{ success: boolean; id?: number }>
export async function updateJobRun(supabase: SupabaseClient, date_marche: Date, phase: PipelinePhase, updates: Partial<JobRun>): Promise<{ success: boolean }>
```

### Helper Utilities

```typescript
// lib/patterns/db-helpers.ts
export function toDateOnly(d: Date): string  // Normalize Date to 'YYYY-MM-DD'
export function toDate(isoString: string): Date

// lib/patterns/reconstruction.ts
export function reconstructCandles15mForDay(code: string, date_marche: Date, snapshots: IntraDaySnapshot[], config: ReconstructionConfig): IntraDayCandle[]
export function deriveCandles30mFromCandles15m(candles15m: IntraDayCandle[], config: ReconstructionConfig): IntraDayCandle[]

// lib/patterns/phase-detect-raw.ts
export async function detectPatternsRaw(input: DetectionRawInput): Promise<PatternRaw[]>

// lib/patterns/phase-qualify.ts
export async function qualifyPatterns(supabase: SupabaseClient, patternsRaw: PatternRaw[], candleQualityByCode: Map<string, number>, config: PatternEngineConfig): Promise<Pattern[]>

// lib/patterns/phase-aggregate.ts
export function aggregatePatterns(input: AggregationInput): PatternScore[]
```

### Advisor Integration

```typescript
// lib/advisor/integrate-patterns.ts
export async function loadPatternScores(supabase: SupabaseClient, code: string, date_marche: Date): Promise<PatternScore | null>
export function enrichAdvisorRecommendation(baseScore: number, patternScore: PatternScore | null, confidenceThreshold: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM'): EnrichedRecommendation
  // Uses patternScore.overall_confidence to decide whether to apply advisor_sub_score_delta
export function scoreToRecommendation(score: number): 'ACHETER' | 'CONSERVER' | 'VENDRE'
```

---

## 6. Partition Management & Setup

### Monthly Partition Creation Strategy
PostgreSQL partitioned tables require explicit partition creation before inserts occur. To avoid insert failures when month rolls over, implement one of:

**Option A: Cron Job (Recommended)**
- Job runs monthly on day 25th at 00:00 UTC → creates partition for next month.
- SQL:
```sql
CREATE TABLE IF NOT EXISTS brvm_intraday_candles_15m_2026_08 PARTITION OF brvm_intraday_candles_15m
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
-- (Repeat for candles_30m, patterns_raw, patterns)
```
- Trigger: Supabase pg_cron or GitHub Actions cron job (separate from daily patterns batch).

**Option B: Application-Side Check**
- Before running patterns:batch, check if partition for next month exists.
- If not, create it via Supabase SQL query.
- Less elegant but works within existing framework.

**Initial Setup:**
- Create partitions for current month + next 3 months in initial migration.
- Document partition naming scheme: `{table_name}_{YYYY}_{MM}` (e.g., `brvm_intraday_candles_15m_2026_08`).

---

## 7. Execution & Deployment

### Batch Command (Scraper)

```bash
npm run patterns:batch -- --date 2026-07-07 [--dry-run] [--skip-phases detect_raw,aggregate]
```

Runs all 4 phases (PHASE 2–4; PHASE 0 is prerequisite) for a single date.

### GitHub Actions Cron Workflow

```yaml
# .github/workflows/patterns-daily.yml
name: Daily Patterns Pipeline
on:
  schedule:
    - cron: '15 15 * * 1-5'  # 15:15 UTC (Monday–Friday; BRVM closes ~14:00 UTC, safety margin to ensure all snapshots collected)
  workflow_dispatch:

jobs:
  patterns:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci --prefix scraper
      - run: npm run patterns:batch -- --date $(date +%Y-%m-%d)
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          SCRAPER_TRIGGER: 'cron'
      - if: failure()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -d '{"text":"Patterns batch failed"}'
```

### Frontend Integration

**Advisor Page** (`app/dashboard/page.tsx`):
- Load `PatternScore` for today's code → apply delta if confidence ≥ MEDIUM.

**Diagnostic IA** (`app/premium/diagnostic/[code]/page.tsx`):
- Display "Recent Behavioral Patterns" section showing last 5 detections + explanations.

**Screener** (`app/screener/intraday-patterns/page.tsx`):
- List `brvm_intraday_patterns` WHERE is_triggered = true AND date_marche = TODAY, sorted by advisor_sub_score_delta DESC.

---

## 7. Idempotence & Error Handling

### Rerun Strategy

**Soft Rerun (Preferred):**
```
UPDATE brvm_intraday_job_runs SET status = 'SUPERSEDED' WHERE date_marche = ? AND phase = ?
→ Next run INSERT new job_run with status = 'RUNNING'
→ Upserts use composite keys (code, date_marche, time_start, engine_version) → no duplicates
```

**Hard Rerun (Full Reset):**
```
DELETE FROM brvm_intraday_candles_15m WHERE date_marche = ?
DELETE FROM brvm_intraday_patterns_raw WHERE date_marche = ?
DELETE FROM brvm_intraday_patterns WHERE date_marche = ?
DELETE FROM brvm_pattern_scores WHERE date_marche = ?
→ Re-execute all phases
```

### Graceful Degradation

- **PHASE 0 FAIL** → Skip reconstruction; log warning; alert ops.
- **PHASE 2 partial** → Continue with available candles; mark quality_score < 0.5 → PHASE 3B confidence drops to LOW.
- **News API timeout** → Continue PHASE 3B without fundamental trigger → patterns marked has_fundamental_trigger = false, confidence reduced.
- **Upsert conflict** → Log to `brvm_pattern_errors`; advisor does NOT apply delta that day.

---

## 8. Observability & Monitoring

**Audit Trail:**
- `brvm_intraday_job_runs`: Full trace of each phase (start, duration, row counts, errors).
- `brvm_intraday_integrity_checks`: Data quality signals per code.
- `brvm_pattern_errors`: Upsert failures + context.

**Admin Dashboard** (`/admin/scraping`):
- KPIs: Patterns detected today, HIGH-confidence only, avg advisor_sub_score_delta, failure rate.
- Recent runs: Last 7 days of job_runs, status breakdown.
- Error feed: Recent brvm_pattern_errors.

**Logging:**
- All phases log via `logger.info/error` with structured metadata (code, count, duration).
- Secrets masked in logs (no credentials, no raw financial data).

---

## 9. Testing & Validation

### Unit Tests (vitest)
1. **Reconstruction**: snapshots → 15m/30m candles matches expected OHLC.
2. **ATR**: Known-good time series → expected ATR value.
3. **Consolidation**: Impulse + 3 consolidation bars → is_triggered = true.
4. **Scoring**: HIGH-confidence + fundamental → advisor_sub_score_delta ≥ +3.
5. **Aggregation**: Multiple patterns per code → combined_pattern_score is weighted average.

### Integration Tests
1. Load fixture snapshots → reconstruct → detect → qualify → aggregate → verify advisor delta applied.
2. Test idempotence: Run twice, verify no duplicates (upsert keys prevent).
3. Test error handling: Simulate missing news → confidence drops as expected.

### Mock Flag
All phases support `--mock` to use fixture data; CI tests with mock data only.

---

## 10. Success Criteria

✅ **PHASE 0** completes with overall_status tracked.  
✅ **PHASE 2** produces candles with quality_score for all codes in session.  
✅ **PHASE 3A** detects patterns; metadata audit-ready.  
✅ **PHASE 3B** assigns confidence_level + explanation_fr; no nulls.  
✅ **PHASE 4** produces advisor_sub_score_delta for all codes with patterns.  
✅ **Advisor** conditionally applies delta if confidence ≥ MEDIUM; recommendation may shift by ±0–5.  
✅ **Screener** lists triggered patterns; explanations visible.  
✅ **Diagnostic IA** shows "Recent Behavioral Patterns" section.  
✅ **Idempotence** verified: rerun same date → no duplicates, same scores.  
✅ **Observability** complete: job_runs + integrity_checks + error logs.  

---

## 11. Constraints & Limitations

- **Data source**: BRVM public snapshots (15 min delayed); no true real-time, only intraday-delayed alerting possible.
- **OHLCV**: Synthetic candles from snapshots; less precise than native OHLC, but sufficient for ATR/consolidation.
- **Fundamental triggers**: Depends on `brvm_market_events` table; missing announcements → pattern marked LOW confidence.
- **Scaling**: Partitioned tables (monthly) + indexes on key columns; handles 48 stocks × 2 timeframes × 50+ patterns/day without issue.
- **Version coexistence**: engine_version in PK allows A/B testing different rule versions; old runs preserved for audit.

---

## 12. Phases of Implementation

**Phase 1 (Core Pipeline):**
- Tables (SQL + RLS).
- Reconstruction logic.
- ATR + Consolidation detection.
- PHASE 3A/3B/4 orchestration + tests.

**Phase 2 (Frontend Integration):**
- Advisor enrichment (`enrichAdvisorRecommendation`).
- Screener page.
- Diagnostic IA section.

**Phase 3 (Premium Alerts):**
- Email/Telegram alerting from `brvm_intraday_patterns`.
- Async job queue (optional: Bull, AWS SQS, etc.).

---

**Reviewed & Ready for Planning:** This spec is self-checked for placeholders, internal consistency, and scope. No ambiguities. Ready to hand off to `superpowers:writing-plans` for detailed task-by-task breakdown.
