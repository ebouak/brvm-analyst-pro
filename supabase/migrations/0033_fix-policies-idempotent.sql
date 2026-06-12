-- Fix non-idempotent policy creation statements
-- This migration cleans up the migration system and allows proper re-application

-- Drop problematic policies that were created without proper idempotence guards
DROP POLICY IF EXISTS "lecture publique income_statements" ON public.income_statements;
DROP POLICY IF EXISTS "lecture publique balance_sheets" ON public.balance_sheets;
DROP POLICY IF EXISTS "lecture publique cash_flow_statements" ON public.cash_flow_statements;

-- Recreate them properly with idempotence
CREATE POLICY "lecture publique income_statements"
  ON public.income_statements FOR SELECT
  USING (true);

CREATE POLICY "lecture publique balance_sheets"
  ON public.balance_sheets FOR SELECT
  USING (true);

CREATE POLICY "lecture publique cash_flow_statements"
  ON public.cash_flow_statements FOR SELECT
  USING (true);
