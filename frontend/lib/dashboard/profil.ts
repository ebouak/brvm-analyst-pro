import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deduireProfil, type Profil } from './widgets';

/**
 * Profil de l'utilisateur, déduit de ses positions (spec §2) : au moins une
 * ligne de `portfolios_positions` avec `quantite > 0`, hors ligne de
 * liquidités. Lecture sous RLS avec la session de l'utilisateur.
 * En cas d'erreur de lecture : 'debutant' — l'ordre par défaut historique,
 * qui ne cache rien (le portefeuille reste présent, plus bas).
 */
export async function chargerProfil(sb: SupabaseClient, userId: string | null): Promise<Profil> {
  if (!userId) return 'debutant';
  const { count, error } = await sb
    .from('portfolios_positions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gt('quantite', 0)
    .or('is_liquidites.is.null,is_liquidites.eq.false');
  if (error) return 'debutant';
  return deduireProfil(count ?? 0);
}
