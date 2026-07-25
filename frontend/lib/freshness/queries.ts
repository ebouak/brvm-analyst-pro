import { createPublicClient } from '@/lib/supabase/public';

/**
 * Charge les deux entrées du calcul de fraîcheur, en lecture publique :
 *  - la dernière collecte intraday (vue v_fraicheur_cours) ;
 *  - la dernière séance présente (date_marche max de brvm_actions_daily).
 */
export async function loadFreshnessInputs(): Promise<{
  derniereCollecte: string | null;
  derniereSeance: string | null;
}> {
  const supabase = createPublicClient();
  const [collecteRes, seanceRes] = await Promise.all([
    supabase.from('v_fraicheur_cours').select('derniere_collecte_intraday').maybeSingle(),
    supabase.from('brvm_actions_daily').select('date_marche')
      .order('date_marche', { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    derniereCollecte: (collecteRes.data?.derniere_collecte_intraday as string | null) ?? null,
    derniereSeance: (seanceRes.data?.date_marche as string | null) ?? null,
  };
}
