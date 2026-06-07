import { createClient } from '@/lib/supabase/server';
import type { FinancialsData } from './types';

export async function loadCompanyFinancials(code: string): Promise<FinancialsData | null> {
  const supabase = createClient();

  const { data: instrument, error: instrError } = await supabase
    .from('brvm_instruments')
    .select('code, designation, secteur, shares')
    .eq('code', code)
    .single();

  if (instrError || !instrument) return null;

  const [dailyRes, incomeRes, balanceRes, cashflowRes] = await Promise.all([
    supabase
      .from('brvm_actions_daily')
      .select('cours_jour, cours_bas_52s, cours_haut_52s')
      .eq('code', code)
      .order('date_marche', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('income_statements')
      .select('*')
      .eq('code', code)
      .eq('type_periode', 'annuel')
      .order('periode', { ascending: false })
      .limit(10),
    supabase
      .from('balance_sheets')
      .select('*')
      .eq('code', code)
      .eq('type_periode', 'annuel')
      .order('periode', { ascending: false })
      .limit(10),
    supabase
      .from('cash_flow_statements')
      .select('*')
      .eq('code', code)
      .eq('type_periode', 'annuel')
      .order('periode', { ascending: false })
      .limit(10),
  ]);

  return {
    instrument: {
      code: instrument.code,
      designation: instrument.designation ?? null,
      secteur: instrument.secteur ?? null,
      shares: instrument.shares ?? null,
    },
    latestDaily: dailyRes.data ?? null,
    incomeStatements: (incomeRes.data ?? []) as any,
    balanceSheets: (balanceRes.data ?? []) as any,
    cashFlowStatements: (cashflowRes.data ?? []) as any,
  };
}
