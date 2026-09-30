import type { SupabaseClient } from '@supabase/supabase-js';
import { lectureIntermediaire, TYPES_INTERIM, type LectureIntermediaire, type LigneComptes } from './interim';

/**
 * Charge les comptes intermédiaires d'une société et les confronte aux
 * exercices annuels DÉJÀ AFFICHÉS par la page (table `fundamentals`) : la
 * règle de remplacement et les 12 mois glissants reposent ainsi sur les mêmes
 * chiffres annuels que ceux que le lecteur voit — y compris les corrections
 * `pdf-verified`, qui ne vivent que dans `fundamentals`.
 *
 * Tolérant : sans ligne intermédiaire ou en cas d'erreur, renvoie null et la
 * page se comporte exactement comme avant.
 */
export async function chargerIntermediaire(
  supabase: SupabaseClient,
  code: string,
  annuels: { year: number | null; revenue: number | null; net_income: number | null }[],
): Promise<LectureIntermediaire | null> {
  try {
    const { data, error } = await supabase
      .from('income_statements')
      .select('periode, revenu_total, resultat_net')
      .eq('code', code)
      .in('type_periode', [...TYPES_INTERIM]);
    if (error || !data || data.length === 0) return null;
    const lignes: LigneComptes[] = [
      ...annuels
        .filter((f) => f.year != null)
        .map((f) => ({ periode: String(f.year), revenu_total: f.revenue, resultat_net: f.net_income })),
      ...(data as LigneComptes[]).map((l) => ({
        periode: l.periode,
        revenu_total: l.revenu_total == null ? null : Number(l.revenu_total),
        resultat_net: l.resultat_net == null ? null : Number(l.resultat_net),
      })),
    ];
    return lectureIntermediaire(lignes);
  } catch {
    return null;
  }
}
