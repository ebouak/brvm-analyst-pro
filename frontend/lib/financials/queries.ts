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

  const [hist52Res, incomeRes, balanceRes, cashflowRes, pubsRes] = await Promise.all([
    // Fetch 260 séances pour calculer plage 52 semaines dynamiquement
    supabase
      .from('brvm_actions_daily')
      .select('cours_jour, date_marche')
      .eq('code', code)
      .order('date_marche', { ascending: false })
      .limit(260),
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
    supabase
      .from('publications')
      .select('id, libelle, date_publication, type_publication, source_url')
      .eq('code', code)
      .order('date_publication', { ascending: false })
      .limit(10),
  ]);

  // Calcul dynamique de la plage 52 semaines à partir de l'historique
  const hist52 = (hist52Res.data ?? []) as { cours_jour: number | null; date_marche: string }[];
  const validCours = hist52.map((r) => r.cours_jour).filter((c): c is number => c != null && c > 0);
  const cours_bas_52s  = validCours.length > 0 ? Math.min(...validCours) : null;
  const cours_haut_52s = validCours.length > 0 ? Math.max(...validCours) : null;
  const cours_jour     = hist52[0]?.cours_jour ?? null;

  return {
    instrument: {
      code: instrument.code,
      designation: instrument.designation ?? null,
      secteur: instrument.secteur ?? null,
      shares: instrument.shares ?? null,
    },
    latestDaily: { cours_jour, cours_bas_52s, cours_haut_52s },
    incomeStatements: (incomeRes.data ?? []) as any,
    balanceSheets: (balanceRes.data ?? []) as any,
    cashFlowStatements: (cashflowRes.data ?? []) as any,
    publications: (pubsRes.data ?? []) as { id: string; libelle: string | null; date_publication: string; type_publication: string | null; source_url: string | null }[],
  };
}
