-- Recovery script for broken migration state
-- Run this in Supabase SQL Editor if supabase db push fails due to conflicts

-- Step 1: Create _migrations table if it doesn't exist
-- This is what Supabase uses to track applied migrations
CREATE TABLE IF NOT EXISTS _migrations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  hash TEXT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 2: Verify critical tables exist
-- If any of these return 0, the schema is incomplete and needs full reapplication
SELECT
  'brvm_instruments' as table_name,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'brvm_instruments') as exists
UNION ALL
SELECT 'brvm_actions_daily', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'brvm_actions_daily')
UNION ALL
SELECT 'paper_trading_accounts', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'paper_trading_accounts')
UNION ALL
SELECT 'paper_trading_positions', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'paper_trading_positions')
UNION ALL
SELECT 'monthly_reports', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'monthly_reports')
UNION ALL
SELECT '_migrations', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '_migrations');

-- Step 3: Count tables in public schema
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public';

-- Step 4: List all public tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
