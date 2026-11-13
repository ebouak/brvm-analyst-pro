import 'server-only';
import { createPublicClient } from '@/lib/supabase/public';
import { derniersReleves, type ReleveCommunaute } from '@/lib/communaute';

/** Derniers relevés publics. Table absente ou illisible = rien d'affiché, jamais un chiffre supposé. */
export async function chargerCommunaute() {
  try {
    const { data, error } = await createPublicClient()
      .from('communaute_releves')
      .select('reseau, releve_le, abonnes, source')
      .order('releve_le', { ascending: false })
      .limit(200);
    if (error) return [];
    return derniersReleves((data ?? []) as ReleveCommunaute[], new Date());
  } catch {
    return [];
  }
}
