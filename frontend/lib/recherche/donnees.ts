import type { SupabaseClient } from '@supabase/supabase-js';
import { chargerUniversActions } from '@/lib/universActions';
import type { DonneesSociete } from './instantane';

/** Faits par société, depuis la base ; null si aucune séance n'est connue. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function chargerDonneesRecherche(supabase: SupabaseClient<any, any, any>): Promise<{ donnees: DonneesSociete[]; dateSeance: string } | null> {
  const [{ univers, dateSeance }, liquidite] = await Promise.all([
    chargerUniversActions(supabase),
    supabase
      .from('liquidity_daily')
      .select('code, classe, date_marche')
      .not('classe', 'is', null)
      .order('date_marche', { ascending: false })
      .limit(400),
  ]);
  if (!dateSeance || univers.length === 0) return null;

  // Dernière classe connue par code (lignes triées de la plus récente à la plus ancienne).
  const classe = new Map<string, DonneesSociete['liquidite']>();
  for (const r of liquidite.data ?? []) {
    const code = r.code as string;
    if (!classe.has(code)) classe.set(code, r.classe as DonneesSociete['liquidite']);
  }

  return {
    dateSeance,
    donnees: univers.map((a) => ({
      code: a.code,
      nom: a.designation,
      secteur: a.secteur,
      activite: a.famille === 'banque' || a.famille === 'assurance' ? a.famille : null,
      pays: a.pays,
      rendement: a.rendement != null ? { valeur: a.rendement, base: a.rendementDejaNet ? ('net' as const) : ('non_precisee' as const) } : null,
      liquidite: classe.get(a.code) ?? null,
      perf12m: a.perf12,
    })),
  };
}
