-- Partition Management: Create future partitions automatically
-- Schedule this to run on the 25th of each month (pg_cron)
-- Prevents insert failures at month boundaries by pre-creating partitions
--
-- This script is idempotent and safe to re-run multiple times.
-- Created for Task 4 of Intraday Patterns implementation.

-- Helper function: Create partition if it doesn't exist
-- Usage: SELECT create_partition_if_not_exists('table_name', '2026-07-01'::DATE, '2026-08-01'::DATE);
CREATE OR REPLACE FUNCTION public.create_partition_if_not_exists(
  table_name TEXT,
  start_date DATE,
  end_date DATE
)
RETURNS TEXT AS $$
DECLARE
  partition_name TEXT;
  sql_stmt TEXT;
BEGIN
  partition_name := table_name || '_' || TO_CHAR(start_date, 'YYYY_MM');

  -- Check if partition already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = partition_name
  ) THEN
    sql_stmt := 'CREATE TABLE IF NOT EXISTS public.' || partition_name ||
                ' PARTITION OF public.' || table_name ||
                ' FOR VALUES FROM (''' || start_date || ''') TO (''' || end_date || ''')';
    EXECUTE sql_stmt;
    RAISE NOTICE 'Created partition: %', partition_name;
    RETURN 'Created partition: ' || partition_name;
  ELSE
    RAISE NOTICE 'Partition already exists: %', partition_name;
    RETURN 'Partition already exists: ' || partition_name;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating partition %: %', partition_name, SQLERRM;
  RETURN 'Error creating partition: ' || partition_name || ' (' || SQLERRM || ')';
END;
$$ LANGUAGE plpgsql;

-- Create partitions for the next 3 months (called on 25th of each month)
-- Current month + next 2 months = 3 partition creations total coverage
-- This ensures new partitions exist before inserts at month boundaries

DO $$
DECLARE
  current_date DATE := CURRENT_DATE;
  partition_start DATE;
  partition_end DATE;
  i INT;
BEGIN
  -- Create partitions for current month and next 2 months
  FOR i IN 0..2 LOOP
    partition_start := DATE_TRUNC('month', current_date + (i * INTERVAL '1 month'))::DATE;
    partition_end := DATE_TRUNC('month', current_date + ((i + 1) * INTERVAL '1 month'))::DATE;

    -- Create partitions for all 4 partitioned tables
    -- These tables are defined in migration 0073 with RANGE PARTITION BY (date_market)
    PERFORM public.create_partition_if_not_exists('brvm_intraday_candles_15m', partition_start, partition_end);
    PERFORM public.create_partition_if_not_exists('brvm_intraday_candles_30m', partition_start, partition_end);
    PERFORM public.create_partition_if_not_exists('brvm_intraday_patterns_raw', partition_start, partition_end);
    PERFORM public.create_partition_if_not_exists('brvm_intraday_patterns', partition_start, partition_end);
  END LOOP;

  RAISE NOTICE 'Partition creation complete: Created partitions for current month + next 2 months';
END $$;

-- Verification query (uncomment to check created partitions):
-- SELECT schemaname, tablename
-- FROM pg_tables
-- WHERE tablename LIKE 'brvm_intraday%'
--   AND tablename NOT IN ('brvm_intraday_candles_15m', 'brvm_intraday_candles_30m', 'brvm_intraday_patterns_raw', 'brvm_intraday_patterns')
-- ORDER BY tablename;
