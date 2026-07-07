# Supabase Partition Management Scripts

Automated scripts for managing time-series table partitions in WESTBOURSE (BRVM Analyst Pro).

## Overview

Time-series tables for intraday patterns and candles are partitioned by month (`date_market`) to optimize query performance and enable efficient data retention policies. This directory contains scripts to automatically create new partitions before month boundaries, preventing insert failures.

## create_partitions.sql

**Purpose:** Automatically create new partitions for time-series tables.

**Tables Managed:**
- `brvm_intraday_candles_15m` (15-minute candlestick data)
- `brvm_intraday_candles_30m` (30-minute candlestick data)
- `brvm_intraday_patterns_raw` (raw pattern detection data)
- `brvm_intraday_patterns` (processed patterns with confidence scores)

All tables are defined in migration 0073 with `RANGE PARTITION BY (date_market)`.

### How It Works

1. **Helper Function:** `create_partition_if_not_exists(table_name, start_date, end_date)`
   - Generates partition name: `{table_name}_{YYYY_MM}`
   - Checks if partition already exists (idempotent)
   - Creates partition using `CREATE TABLE ... PARTITION OF` syntax
   - Returns status message (created or already exists)

2. **Main Block:** Anonymous PL/pgSQL block
   - Iterates through current month + next 2 months
   - Calls helper function for each table and month
   - Ensures new partitions exist before inserts at month boundaries

3. **Partition Naming Convention:** `table_name_YYYY_MM`
   - Example: `brvm_intraday_candles_15m_2026_07` (July 2026 partition)
   - Matches migration 0073 partition naming scheme

### Example Partition Range

For script run on 2026-07-07:
- **Month 0 (July 2026):** `2026-07-01` to `2026-08-01`
- **Month 1 (August 2026):** `2026-08-01` to `2026-09-01`
- **Month 2 (September 2026):** `2026-09-01` to `2026-10-01`

### Idempotency

The script is safe to re-run multiple times:
- Helper function checks for existing partitions before creating
- Uses `CREATE TABLE IF NOT EXISTS` as safety measure
- Logs status messages instead of failing
- No side effects from repeated execution

## Scheduling

### Option A: PostgreSQL Cron (pg_cron)

Schedule partition creation to run on the 25th of each month at 9:00 AM UTC:

```sql
-- Create cron job (run once to set up schedule)
SELECT cron.schedule('create-partitions-monthly', '0 9 25 * *', $$
  SELECT public.create_partition_if_not_exists(
    'brvm_intraday_candles_15m',
    DATE_TRUNC('month', CURRENT_DATE)::DATE,
    DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month')::DATE
  );
  -- Repeat for other 3 tables...
$$);

-- List all cron jobs
SELECT * FROM cron.job;

-- Remove a cron job (if needed)
SELECT cron.unschedule('create-partitions-monthly');
```

**Advantages:**
- Runs inside PostgreSQL (no external dependencies)
- Works with Supabase without additional infrastructure
- Reliable scheduling with job logging

**Limitations:**
- Requires pg_cron extension enabled (usually available in Supabase)
- Less flexible for complex scheduling logic

### Option B: GitHub Actions Workflow

Schedule daily execution via GitHub Actions (creates partitions only if needed):

**File:** `.github/workflows/create-partitions.yml`

```yaml
name: Create Database Partitions

on:
  schedule:
    # Run daily at 3 AM UTC (25th of month is handled by idempotent script)
    - cron: '0 3 * * *'
  workflow_dispatch:

jobs:
  create-partitions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Supabase CLI
        uses: supabase/setup-cli@v1

      - name: Create database partitions
        env:
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
        run: |
          supabase db execute --file supabase/scripts/create_partitions.sql

      - name: Notify on failure
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '⚠️ Partition creation failed. Check workflow logs.'
            })
```

**Advantages:**
- Flexible scheduling (daily, weekly, custom)
- Easy to add notifications/alerts
- Integrates with CI/CD pipeline
- Logs stored in GitHub Actions

**Limitations:**
- Requires GitHub Actions secrets (`SUPABASE_PROJECT_REF`, etc.)
- Small delay between trigger and execution

## Testing

### Manual Execution

In Supabase SQL Editor, execute:

```sql
-- Run the script
\i supabase/scripts/create_partitions.sql

-- Or copy-paste the entire script content

-- Verify partitions were created
SELECT schemaname, tablename
FROM pg_tables
WHERE tablename LIKE 'brvm_intraday%'
  AND tablename NOT IN (
    'brvm_intraday_candles_15m',
    'brvm_intraday_candles_30m',
    'brvm_intraday_patterns_raw',
    'brvm_intraday_patterns'
  )
ORDER BY tablename;
```

Expected output (example for 2026-07-07 run):
```
 schemaname │            tablename
─────────────┼──────────────────────────────────
 public      │ brvm_intraday_candles_15m_2026_07
 public      │ brvm_intraday_candles_15m_2026_08
 public      │ brvm_intraday_candles_15m_2026_09
 public      │ brvm_intraday_candles_30m_2026_07
 public      │ brvm_intraday_candles_30m_2026_08
 public      │ brvm_intraday_candles_30m_2026_09
 public      │ brvm_intraday_patterns_raw_2026_07
 public      │ brvm_intraday_patterns_raw_2026_08
 public      │ brvm_intraday_patterns_raw_2026_09
 public      │ brvm_intraday_patterns_2026_07
 public      │ brvm_intraday_patterns_2026_08
 public      │ brvm_intraday_patterns_2026_09
(12 rows)
```

### Testing Idempotence

Run the script twice and verify no errors:

```sql
-- First run
\i supabase/scripts/create_partitions.sql

-- Second run (should complete without errors)
\i supabase/scripts/create_partitions.sql

-- Check logs for "already exists" messages
```

### Testing Constraints

Verify partitions enforce correct date ranges:

```sql
-- Insert a row with date at partition boundary
INSERT INTO brvm_intraday_candles_15m
  (date_market, instrument_code, time_interval, open, high, low, close, volume)
VALUES
  ('2026-08-01'::DATE, 'BRVM-C', 15, 1000.0, 1010.0, 990.0, 1005.0, 100000);

-- Verify it lands in correct partition (brvm_intraday_candles_15m_2026_08)
SELECT tableoid::regclass, * FROM brvm_intraday_candles_15m WHERE date_market = '2026-08-01';
```

## Troubleshooting

### Partitions Don't Exist

**Symptom:** After running script, partition table query returns no results.

**Solutions:**
1. Verify migration 0073 applied: `SELECT * FROM migrations WHERE name LIKE '%0073%';`
2. Check that parent tables exist: `SELECT * FROM pg_tables WHERE tablename LIKE 'brvm_intraday%' AND schemaname = 'public';`
3. Run script manually in Supabase SQL editor and check for errors

### Syntax Errors

**Symptom:** `ERROR: syntax error in SQL statement`

**Solutions:**
1. Verify PostgreSQL version ≥ 12.0 (check: `SELECT version();`)
2. Ensure partitioned tables exist before running script
3. Try removing any special characters from the script file (encoding issue)

### Permission Denied

**Symptom:** `ERROR: permission denied for schema public`

**Solutions:**
1. Use `SUPABASE_SERVICE_ROLE_KEY` (not anon key) for script execution
2. Verify user role has `CREATE` permission on public schema
3. Contact Supabase support if using restricted roles

### Partition Creation Hangs

**Symptom:** Script runs but never completes (timeout)

**Solutions:**
1. Check for locks: `SELECT * FROM pg_locks WHERE NOT granted;`
2. Cancel long-running queries: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active';`
3. Run during off-peak hours (if possible)

## Monitoring

### Check Partition Distribution

Monitor partition growth and data distribution:

```sql
-- Table size by partition
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'brvm_intraday%'
  AND tablename NOT IN (
    'brvm_intraday_candles_15m',
    'brvm_intraday_candles_30m',
    'brvm_intraday_patterns_raw',
    'brvm_intraday_patterns'
  )
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;

-- Count of rows per partition
SELECT
  tableoid::regclass,
  COUNT(*) AS row_count
FROM brvm_intraday_candles_15m
GROUP BY tableoid
ORDER BY tableoid;
```

### Alert Setup

Set up alerts for partition issues:

```sql
-- Alert if partition is almost full (within 90% of month boundary)
SELECT
  'WARNING: Partition approaching boundary'::TEXT AS alert,
  schemaname,
  tablename,
  MAX(date_market) AS max_date
FROM brvm_intraday_candles_15m
GROUP BY schemaname, tablename
HAVING MAX(date_market) > (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '27 days')::DATE;
```

## Dependencies

- **PostgreSQL:** Version 12.0 or higher (for `RANGE PARTITION BY` syntax)
- **Supabase:** pg_cron extension (for scheduled execution)
- **Migration 0073:** Must be applied before running this script

## Related Files

- `supabase/migrations/0073_intraday_patterns_schema.sql` — Defines partitioned tables
- `supabase/migrations/0074_intraday_rls.sql` — RLS policies for intraday tables
- `.github/workflows/intraday.yml` — Existing intraday scraper workflow

## Version History

- **v1.0 (2026-07-07):** Initial release with 4 tables, 3-month lookahead
  - Helper function `create_partition_if_not_exists`
  - Anonymous block for automatic partition creation
  - Idempotent design for safe re-execution

## Future Enhancements

- [ ] Add metrics table to track partition creation history
- [ ] Implement automatic cleanup of old partitions (retention policy)
- [ ] Add Slack notifications on partition creation success/failure
- [ ] Support for different partition strategies (weekly, quarterly)
- [ ] Integration with Supabase Vault for secret management
