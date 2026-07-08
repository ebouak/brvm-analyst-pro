# Intraday Patterns — Deployment & Operations

This document covers deployment, scheduling, monitoring, and troubleshooting for the intraday patterns detection system.

---

## Architecture Overview

The intraday patterns system detects volatility spikes and bullish consolidation patterns on 15-minute candles. It runs daily post-market (15:15 UTC Mon–Fri) and feeds advisor signals + monitoring dashboard.

**Data Flow:**

1. **Snapshots** → `brvm_actions_daily` intraday rows (collected during market hours)
2. **Integrity Check** (PHASE 0) → validate snapshot continuity, volume plausibility
3. **Reconstruction** (PHASE 2) → aggregate snapshots into 15m/30m candles with quality scores
4. **Detection** (PHASE 3A) → identify raw patterns (ATR extremes, consolidations)
5. **Qualification** (PHASE 3B) → assign confidence levels (HIGH/MEDIUM/LOW)
6. **Aggregation** (PHASE 4) → daily scores + advisor delta (-5 to +5)
7. **Persistence** → write to partitioned tables
8. **Monitoring** → log job status to `brvm_intraday_job_runs`

**Key Tables:**

| Table | Purpose | Partitioned |
|-------|---------|------------|
| `brvm_intraday_candles_15m` | Reconstructed 15-minute candles | Yes (by month) |
| `brvm_intraday_candles_30m` | Reconstructed 30-minute candles | Yes |
| `brvm_intraday_patterns_raw` | Raw pattern detections (PHASE 3A) | Yes |
| `brvm_intraday_patterns` | Qualified patterns (PHASE 3B) | Yes |
| `brvm_pattern_scores` | Aggregated scores + advisor delta | No |
| `brvm_intraday_job_runs` | Execution audit trail | No |
| `brvm_pattern_errors` | Error log | No |
| `brvm_intraday_integrity_checks` | PHASE 0 validation results | No |
| `brvm_pattern_engine_config` | Versioned algorithm config | No |

**Daily Timeline (UTC):**

```
15:00 UTC     Market close (BRVM)
15:00–15:15   Intraday snapshots continue to accumulate
15:15         GitHub Actions workflow triggers
15:15–15:30   Mock validation run (no DB writes)
15:30–15:45   Live production run
15:45         Results available in dashboard + advisor
```

---

## Deployment Checklist

### Prerequisites

- [ ] Node.js ≥ 20 installed
  ```bash
  node --version  # should be v20.x.x or higher
  ```

- [ ] Supabase project provisioned
  - Project URL: `https://your-project.supabase.co`
  - Service role key obtained (keep secret)

- [ ] GitHub repository with Actions enabled

- [ ] GitHub Secrets configured
  ```bash
  gh secret set SUPABASE_URL --body "https://your-project.supabase.co"
  gh secret set SUPABASE_SERVICE_ROLE_KEY --body "eyJhbGc..."
  ```

### Database Setup

- [ ] **Step 1: Run migrations** (in Supabase SQL Editor, in order)
  ```sql
  -- Copy and execute:
  -- supabase/migrations/0073_intraday_patterns_schema.sql
  -- supabase/migrations/0074_intraday_patterns_rls.sql
  -- supabase/migrations/0075_seed_pattern_engine_config.sql
  ```
  
  Or via CLI:
  ```bash
  cd supabase
  supabase db push  # if local development
  ```

- [ ] **Step 2: Create initial partitions**
  ```sql
  -- In Supabase SQL Editor, copy and run:
  -- supabase/scripts/create_partitions.sql
  ```
  
  This creates partitions for current month + next 2 months automatically.

- [ ] **Step 3: Verify schema**
  ```sql
  -- Run in Supabase SQL Editor:
  SELECT table_name 
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND (table_name LIKE 'brvm_intraday%' OR table_name LIKE 'brvm_pattern%')
  ORDER BY table_name;
  
  -- You should see 14 tables + 4 initial partitions
  ```

### Workflow Deployment

- [ ] **Code is pushed to main branch**
  - Includes `.github/workflows/patterns-daily.yml`
  - Latest scraper code (`scraper/src/intraday/`)

- [ ] **GitHub Secrets verified**
  ```bash
  gh secret list  # Should show SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  ```

- [ ] **Manual trigger test**
  ```bash
  gh workflow run patterns-daily.yml --ref main
  # Monitor at: https://github.com/YOUR_ORG/YOUR_REPO/actions
  ```

### Verification

- [ ] Mock run completes (GitHub Actions → patterns-daily → Run mock patterns batch)
  - Check for ✅ or ❌ status

- [ ] Live run completes and writes data
  ```sql
  -- In Supabase SQL Editor:
  SELECT COUNT(*) as patterns_count FROM brvm_intraday_patterns;
  SELECT * FROM brvm_intraday_job_runs 
  ORDER BY created_at DESC LIMIT 3;
  ```
  - Should see rows with `status='SUCCESS'`

- [ ] Admin dashboard displays data
  - Navigate to `/admin/scraping` (super_admin role required)
  - KPI cards show patterns detected

---

## Scheduling

### Daily Cron Schedule

The workflow runs automatically on a **daily schedule**:

```yaml
# .github/workflows/patterns-daily.yml
on:
  schedule:
    - cron: '15 15 * * 1-5'  # Every Mon–Fri at 15:15 UTC
```

**Why 15:15 UTC?**

- BRVM closes at 15:00 UTC (14:00 GMT+1 Dakar time)
- Intraday snapshots accumulate until ~15:15 (final orders settle)
- 15-minute buffer ensures complete snapshot set for reconstruction
- Patterns analyzed for yesterday's session + today's early moves

**Timezone Reference:**

| Timezone | Time |
|----------|------|
| UTC | 15:15 |
| GMT+1 (BRVM Abidjan) | 16:15 |
| CET | 16:15 (winter) or 17:15 (summer) |

### Manual Trigger

To run outside the schedule:

```bash
# Trigger via GitHub CLI
gh workflow run patterns-daily.yml --ref main

# Monitor progress
gh workflow view patterns-daily.yml
```

### Disable Temporarily

To pause scheduled execution (e.g., for maintenance):

```bash
# Edit .github/workflows/patterns-daily.yml
# Comment out or remove the schedule section:
#
# on:
#   schedule:
#     - cron: '15 15 * * 1-5'  # <-- DISABLED
#   workflow_dispatch: {}

# Commit and push
git add .github/workflows/patterns-daily.yml
git commit -m "ci(patterns): temporarily disable schedule for maintenance"
git push
```

Then re-enable by uncommenting and pushing.

---

## Monitoring & Alerts

### Admin Dashboard

Access at **`https://your-frontend/admin/scraping`** (super_admin role required).

**Displays:**

- **KPI Cards:** Runs today, success/failed, patterns detected, avg duration
- **Job Runs Table:** Last 50 executions with phase, status, duration, errors
- **Error Feed:** Recent error messages (last 20)
- **Trend Chart:** Patterns detected over last 7 days

### Key Monitoring Tables

**Check job status:**
```sql
SELECT date_marche, phase, status, duration_ms, errors_count
FROM brvm_intraday_job_runs
ORDER BY created_at DESC
LIMIT 10;
```

**Check for errors:**
```sql
SELECT date_marche, phase, code, error_message, created_at
FROM brvm_pattern_errors
WHERE date_marche >= (CURRENT_DATE - INTERVAL '1 day')
ORDER BY created_at DESC;
```

**Check pattern results:**
```sql
SELECT code, date_marche, patterns_detected_count, advisor_sub_score_delta
FROM brvm_pattern_scores
WHERE date_marche = CURRENT_DATE
ORDER BY patterns_detected_count DESC;
```

**Check candle quality:**
```sql
SELECT code, COUNT(*) as candle_count, AVG(quality_score) as avg_quality
FROM brvm_intraday_candles_15m
WHERE date_marche = CURRENT_DATE
GROUP BY code
HAVING AVG(quality_score) < 0.5;  -- Low quality
```

### Alert Conditions

| Status | Action |
|--------|--------|
| 🔴 Job status = FAILED | Investigate immediately (check error log) |
| 🟡 Error count > 20% of codes | Partial success (manual rerun recommended) |
| 🟡 Duration > 15 minutes | Performance issue (check Supabase CPU, indices) |
| 🟡 Avg quality_score < 0.5 | Data quality concern (check snapshots) |
| 🟢 All SUCCESS, 0 errors | Nominal operation |

### Slack Notifications (Optional)

If `SLACK_WEBHOOK` secret is configured, failures automatically post to Slack. To enable:

1. Create Slack incoming webhook (Slack App Directory → Incoming Webhooks)
2. Add GitHub secret:
   ```bash
   gh secret set SLACK_WEBHOOK --body "https://hooks.slack.com/services/..."
   ```

---

## Troubleshooting

### Issue: "No patterns detected"

**Symptoms:** `brvm_pattern_scores` has 0 rows, or patterns_detected_count is 0.

**Debug Steps:**

1. Check snapshot data for today:
   ```sql
   SELECT code, COUNT(*) as snapshot_count, 
          MIN(timestamp_utc) as earliest, MAX(timestamp_utc) as latest
   FROM brvm_actions_daily
   WHERE date_marche = CURRENT_DATE
   GROUP BY code
   ORDER BY snapshot_count DESC;
   ```
   - If snapshot_count < 4 per code: insufficient data for 15m candles

2. Check candle reconstruction:
   ```sql
   SELECT code, COUNT(*) as candle_count, 
          AVG(quality_score) as avg_quality,
          MIN(quality_score) as min_quality
   FROM brvm_intraday_candles_15m
   WHERE date_marche = CURRENT_DATE
   GROUP BY code;
   ```
   - If candle_count = 0: reconstruction failed
   - If avg_quality < 0.5: low quality (timestamps, volume data issues)

3. Check integrity checks:
   ```sql
   SELECT code, check_type, status, message
   FROM brvm_intraday_integrity_checks
   WHERE date_marche = CURRENT_DATE
   AND status != 'PASS';
   ```

**Fixes:**

- **If snapshots < 4:** Increase snapshot collection window or lower quality threshold
- **If candles = 0:** Check scraper logs for reconstruction errors
- **If quality < 0.5:** Verify snapshot timestamps are monotonic, volumes realistic

---

### Issue: "Partition error: no matching partition"

**Error Message:** `ERROR: no matching partition for new row in table "brvm_intraday_patterns"`

**Cause:** Partition for current month doesn't exist (boundary between months).

**Debug:**
```sql
-- List existing partitions
SELECT tablename FROM pg_tables
WHERE tablename LIKE 'brvm_intraday_patterns_%'
ORDER BY tablename;

-- Check if current month partition exists
SELECT DATE_TRUNC('month', CURRENT_DATE)::DATE;
-- Look for partition matching that month in results above
```

**Fix (Immediate):**
```sql
-- Run in Supabase SQL Editor:
-- supabase/scripts/create_partitions.sql
-- This creates partitions for current month + next 2 months
```

**Prevention (Automated):**
Schedule partition creation via GitHub Actions cron (separate workflow):
```yaml
name: Create Monthly Partitions
on:
  schedule:
    - cron: '0 0 25 * *'  # 25th of each month at 00:00 UTC
jobs:
  create-partitions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Create partitions
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          psql $SUPABASE_CONNECTION_STRING < supabase/scripts/create_partitions.sql
```

---

### Issue: "Live run fails but mock passes"

**Symptoms:** Mock run succeeds (`USE_MOCK=true`), but live run (`USE_MOCK=false`) fails.

**Cause:** Missing Supabase credentials or RLS policies blocking writes.

**Debug:**

1. Check GitHub Secrets:
   ```bash
   gh secret list | grep SUPABASE
   ```
   - Both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` should be present

2. Test credentials locally:
   ```bash
   cd scraper
   SUPABASE_URL=https://your-project.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... \
   npm run intraday:patterns:mock
   ```

3. Check RLS policies:
   ```sql
   -- In Supabase SQL Editor:
   SELECT policyname, qual
   FROM pg_policies
   WHERE tablename IN ('brvm_intraday_patterns', 'brvm_pattern_scores')
   AND schemaname = 'public';
   ```

**Fixes:**

- **If secrets missing:** Re-add via `gh secret set`
- **If credentials wrong:** Verify URL and key in Supabase Project Settings → API
- **If RLS blocks writes:** Ensure `service_role` policy allows INSERT/UPDATE
  ```sql
  -- Example: Grant service_role write access (if needed)
  ALTER POLICY "Enable service_role writes" ON brvm_intraday_patterns
  USING (true) WITH CHECK (true);
  ```

---

### Issue: "API rate limit hit"

**Error Message:** `Error: You've hit your weekly limit` (if LLM features enabled)

**Cause:** Weekly token budget exhausted for Claude API (if pattern explanations use LLM).

**Debug:**
```bash
# Check GitHub Actions logs for rate limit message
gh run view <RUN_ID> --log
```

**Fixes:**

1. **Wait for rate limit reset** (usually 24 hours; check error details)
2. **Reduce LLM calls:** Disable explanation generation if cost is concern
3. **Request higher limits:** Contact Claude API support for production quota
4. **Batch explanations:** Generate only for HIGH confidence patterns:
   ```typescript
   if (confidence === 'HIGH') {
     explanation = await generateExplanation(pattern);
   }
   ```

---

### Issue: "DRY_RUN mode not clearing test data"

**Symptoms:** Test data persists in DB after dry-run; can't distinguish from real runs.

**Cause:** `DRY_RUN=true` set in workflow but mock mode not used.

**Debug:**
```bash
# Check workflow logs for DRY_RUN messages
gh run view <RUN_ID> --log | grep -i "dry.run"
```

**Fix:**
```sql
-- Delete test data with specific engine_version or timestamp
DELETE FROM brvm_intraday_patterns
WHERE engine_version = 'v1.0.0-test' OR created_at > NOW() - INTERVAL '1 hour';

-- Or use mock run which doesn't write at all
# In workflow: use USE_MOCK=true for safe testing
```

---

## Maintenance

### Monthly: Create next month's partitions

On the **25th of each month**, partitions auto-create via scheduled job (see Troubleshooting section for automated workflow).

**Manual execution (if needed):**
```sql
-- Copy and run in Supabase SQL Editor:
-- supabase/scripts/create_partitions.sql
```

**Verify:**
```sql
SELECT tablename FROM pg_tables
WHERE tablename LIKE 'brvm_intraday_patterns_%'
ORDER BY tablename DESC
LIMIT 5;
```

### Quarterly: Archive old data

Archive patterns older than 6 months to improve query performance:

```sql
-- Option 1: Delete old data
DELETE FROM brvm_intraday_patterns
WHERE date_marche < (CURRENT_DATE - INTERVAL '6 months');

-- Option 2: Export to archive before deleting
COPY brvm_intraday_patterns TO '/tmp/patterns_archive.csv'
WHERE date_marche < (CURRENT_DATE - INTERVAL '6 months');
DELETE FROM brvm_intraday_patterns
WHERE date_marche < (CURRENT_DATE - INTERVAL '6 months');
```

### When Rules Change: Update engine version

If detection logic (ATR threshold, consolidation criteria) changes:

1. Update rules in `scraper/src/intraday/`:
   ```typescript
   // Example: Increase ATR multiplier
   const ATR_MULTIPLIER = 3.5;  // was 3.0
   ```

2. Create new engine version entry:
   ```sql
   INSERT INTO brvm_pattern_engine_config (
     engine_version, rules_version, atr_period, atr_multiplier, 
     consolidation_min_bars, is_active
   ) VALUES (
     'v1.1.0', 'rules_2026_08', 14, 3.5, 3, true
   );
   
   -- Mark old version inactive
   UPDATE brvm_pattern_engine_config SET is_active = false 
   WHERE engine_version = 'v1.0.0';
   ```

3. Deploy code + trigger backfill:
   ```bash
   git push
   # Optionally backfill past dates with new version
   npm run intraday:patterns:backfill -- --from 2026-07-01 --engine v1.1.0
   ```

### Performance Tuning

Monitor table sizes and slow queries:

```sql
-- Table sizes
SELECT 
  tablename, 
  pg_size_pretty(pg_total_relation_size('public.' || tablename)) as size
FROM pg_tables
WHERE tablename LIKE 'brvm_intraday%'
ORDER BY tablename;

-- Slow queries (from pg_stat_statements)
SELECT 
  query, calls, mean_time, max_time
FROM pg_stat_statements
WHERE query LIKE '%brvm_intraday%'
ORDER BY mean_time DESC
LIMIT 10;

-- Rebuild indices if fragmented
REINDEX INDEX idx_patterns_date;
ANALYZE brvm_intraday_patterns;
```

**Common optimizations:**

- Add partial index for high-confidence patterns:
  ```sql
  CREATE INDEX idx_patterns_high_confidence 
  ON brvm_intraday_patterns(code, date_marche)
  WHERE confidence_level = 'HIGH';
  ```

- Cluster table on primary key (rare, after major deletes):
  ```sql
  CLUSTER brvm_intraday_patterns USING brvm_intraday_patterns_pkey;
  ```

---

## Rollback Procedure

If a deployment introduces bugs or corrupts data:

### 1. Stop the workflow (immediate)

```bash
# Edit .github/workflows/patterns-daily.yml
# Comment out the schedule section:
#
# on:
#   schedule:
#     - cron: '15 15 * * 1-5'  # <-- COMMENTED OUT
#   workflow_dispatch: {}

git add .github/workflows/patterns-daily.yml
git commit -m "ci(patterns): emergency disable schedule during rollback"
git push
```

Workflow will stop running; manual triggers still work.

### 2. Revert code to last known good version

```bash
# Find the bad commit
git log --oneline | head -20

# Revert to previous version
git revert <BAD_COMMIT_HASH>
git push
```

Or reset to specific tag:
```bash
git reset --hard v1.0.0
git push --force
```

### 3. Clean corrupted data

```sql
-- Delete patterns from the bad run
DELETE FROM brvm_intraday_patterns
WHERE engine_version = 'v1.0.0'
AND date_marche >= '2026-07-08';

DELETE FROM brvm_pattern_scores
WHERE date_marche >= '2026-07-08'
AND engine_version = 'v1.0.0';

-- Verify deletion
SELECT COUNT(*) FROM brvm_intraday_patterns WHERE date_marche >= '2026-07-08';
```

### 4. Restore previous engine version

```sql
-- Re-activate previous version
UPDATE brvm_pattern_engine_config
SET is_active = true
WHERE engine_version = 'v0.9.0';

UPDATE brvm_pattern_engine_config
SET is_active = false
WHERE engine_version = 'v1.0.0';
```

### 5. Re-enable workflow

```bash
# Uncomment the schedule section in .github/workflows/patterns-daily.yml
# on:
#   schedule:
#     - cron: '15 15 * * 1-5'  # RE-ENABLED

git add .github/workflows/patterns-daily.yml
git commit -m "ci(patterns): re-enable schedule after successful rollback"
git push

# Manually trigger once to verify
gh workflow run patterns-daily.yml --ref main
```

---

## Support & Escalation

### Common Resources

- **Architecture:** `docs/` folder (SCRAPER.md, SCORING.md)
- **Code:** `scraper/src/intraday/` (patterns detection logic)
- **Workflows:** `.github/workflows/patterns-daily.yml`
- **Migrations:** `supabase/migrations/0073-0075`

### Logs & Data

| Location | Content | Access |
|----------|---------|--------|
| GitHub Actions | Workflow logs, timestamps, errors | `.github/workflows/patterns-daily.yml` → run details |
| Supabase SQL | `brvm_intraday_job_runs`, `brvm_pattern_errors` | Supabase Dashboard → SQL Editor |
| Supabase Logs | Realtime function/webhook logs | Supabase Dashboard → Logs |
| Local logs | Development testing | `npm run intraday:patterns` with `LOG_LEVEL=debug` |

### Escalation Path

1. **Check admin dashboard** (`/admin/scraping`) for KPIs and error summaries
2. **Query monitoring tables** (job_runs, pattern_errors) for details
3. **Review GitHub Actions logs** for runtime errors
4. **Run mock mode locally** to isolate infrastructure vs. logic issues
5. **Contact infra team:** DB performance, partition issues, Supabase limits
6. **Contact dev team:** Algorithm bugs, edge cases, regressions

---

## References

- **CLAUDE.md** — Project overview, env vars, stack
- **SCRAPER.md** — Scraper architecture, modules
- **DEPLOYMENT.md** — General deployment guide (GitHub Actions, cron)
- **SCORING.md** — Signal generation (complementary to patterns)
