-- ============================================================================
-- MIGRATION RECOVERY SCRIPT
-- Run this in Supabase SQL Editor to fix the broken migration state
-- ============================================================================

-- Step 1: Create _migrations table if missing (required by Supabase)
CREATE TABLE IF NOT EXISTS _migrations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  hash TEXT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Step 2: Drop conflicting policies that caused the error
-- These exist but _migrations doesn't, so they were created manually or in a partial run
DROP POLICY IF EXISTS "lecture publique income_statements" ON public.income_statements;
DROP POLICY IF EXISTS "lecture publique balance_sheets" ON public.balance_sheets;
DROP POLICY IF EXISTS "lecture publique cash_flow_statements" ON public.cash_flow_statements;

-- Step 3: Verify core tables exist
-- These should exist after 0001_init.sql
SELECT
  'brvm_instruments'::text as "Table",
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='brvm_instruments') as "Exists"
UNION ALL
SELECT 'brvm_actions_daily', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='brvm_actions_daily')
UNION ALL
SELECT 'paper_trading_accounts', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='paper_trading_accounts')
UNION ALL
SELECT 'paper_trading_positions', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='paper_trading_positions')
UNION ALL
SELECT 'monthly_reports', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='monthly_reports');

-- Step 4: Count public tables
SELECT COUNT(*) as "Total Public Tables"
FROM information_schema.tables
WHERE table_schema = 'public';
