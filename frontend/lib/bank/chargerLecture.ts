import type { SupabaseClient } from '@supabase/supabase-js';
import { periodesDepuisLignes, type LigneComptesBancaire, type PeriodeBancaire } from './lecture';

/**
 * Lignes de comptes d'une banque (tables publiques) → périodes bancaires.
 * Une erreur de lecture rend [] : la surface garde alors l'ancien affichage,
 * qui ne montre aucun chiffre faux. L'erreur est journalisée.
 */
export async function chargerPeriodesBancaires(sb: SupabaseClient, code: string): Promise<PeriodeBancaire[]> {
  const [inc, bal] = await Promise.all([
    sb.from('income_statements').select('periode,resultat_net,lignes_specifiques,sources_specifiques').eq('code', code),
    sb.from('balance_sheets').select('periode,total_capitaux_propres,lignes_specifiques,sources_specifiques').eq('code', code),
  ]);
  if (inc.error || bal.error) {
    console.error(`[lecture bancaire] ${code} : ${inc.error?.message ?? bal.error?.message}`);
    return [];
  }
  return periodesDepuisLignes((inc.data ?? []) as LigneComptesBancaire[], (bal.data ?? []) as LigneComptesBancaire[]);
}
