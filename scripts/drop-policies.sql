-- Drop problematic policies that were created in partial migration run
-- These must be dropped before migrations can be reapplied

DROP POLICY IF EXISTS "lecture publique income_statements" ON public.income_statements;
DROP POLICY IF EXISTS "lecture publique balance_sheets" ON public.balance_sheets;
DROP POLICY IF EXISTS "lecture publique cash_flow_statements" ON public.cash_flow_statements;
