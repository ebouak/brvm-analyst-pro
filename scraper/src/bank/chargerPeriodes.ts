/**
 * Lignes de comptes d'une banque → périodes bancaires, côté scraper (articles).
 * Lève en cas d'erreur : un article ne s'écrit pas sur une lecture partielle.
 */
import { getSupabase } from '../persistence/supabase.js';
import { periodesDepuisLignes, type LigneComptesBancaire, type PeriodeBancaire } from './pure/lecture.js';

export async function chargerPeriodesBancaires(code: string): Promise<PeriodeBancaire[]> {
  const sb = getSupabase();
  const [inc, bal] = await Promise.all([
    sb.from('income_statements').select('periode,resultat_net,lignes_specifiques,sources_specifiques').eq('code', code),
    sb.from('balance_sheets').select('periode,total_capitaux_propres,lignes_specifiques,sources_specifiques').eq('code', code),
  ]);
  if (inc.error) throw new Error(`income_statements ${code} : ${inc.error.message}`);
  if (bal.error) throw new Error(`balance_sheets ${code} : ${bal.error.message}`);
  return periodesDepuisLignes((inc.data ?? []) as LigneComptesBancaire[], (bal.data ?? []) as LigneComptesBancaire[]);
}
