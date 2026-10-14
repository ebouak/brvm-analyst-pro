import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LIQUIDITES_CODE } from '@/lib/portfolio/constantes';
import { deduireProfil, type Profil } from './widgets';

/**
 * Profil de l'utilisateur, déduit de ses positions (spec §2) : au moins une
 * ligne de `portfolios_positions` avec `quantite > 0`, hors ligne de
 * liquidités (code LIQUIDITES). Lecture sous RLS avec la session de
 * l'utilisateur.
 * En cas d'erreur de lecture : 'debutant' — l'ordre par défaut historique,
 * qui ne cache rien (le portefeuille reste présent, plus bas). L'erreur est
 * journalisée pour qu'une régression de schéma ne passe pas inaperçue (un bug
 * identique est resté invisible parce que l'erreur était avalée).
 */
export async function chargerProfil(sb: SupabaseClient, userId: string | null): Promise<Profil> {
  if (!userId) return 'debutant';
  const { count, error } = await sb
    .from('portfolios_positions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gt('quantite', 0)
    .neq('code', LIQUIDITES_CODE);
  if (error) {
    console.error('[dashboard] lecture du profil impossible :', error.message);
    return 'debutant';
  }
  return deduireProfil(count ?? 0);
}
