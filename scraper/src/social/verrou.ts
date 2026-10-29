import { getSupabase } from '../persistence/supabase.js';
import type { ReseauSocial } from './jetons.js';

/**
 * Verrou de publication (`publications_sociales`, migration 0170) : la ligne
 * est insérée AVANT l'appel à l'API. Une relance tombe sur la clé primaire et
 * ne publie rien deux fois. Seul un `echec` se reprend ; un `en_cours` resté
 * en plan est signalé par `sante:reseaux`, jamais repris automatiquement —
 * l'API a pu publier avant que le statut ne soit écrit.
 */
export type Cible = 'article' | 'video';

export async function prendreVerrou(cible: Cible, cibleId: string, reseau: ReseauSocial): Promise<boolean> {
  const sb = getSupabase();
  const maintenant = new Date().toISOString();
  const { error } = await sb.from('publications_sociales').insert({ cible, cible_id: cibleId, reseau, statut: 'en_cours', lance_le: maintenant });
  if (!error) return true;
  if (error.code !== '23505') throw new Error(`verrou ${reseau} : ${error.message}`);
  const { data } = await sb
    .from('publications_sociales')
    .update({ statut: 'en_cours', erreur: null, post_id: null, lance_le: maintenant, termine_le: null })
    .eq('cible', cible)
    .eq('cible_id', cibleId)
    .eq('reseau', reseau)
    .eq('statut', 'echec')
    .select('cible_id');
  return (data?.length ?? 0) > 0;
}

export async function terminer(
  cible: Cible,
  cibleId: string,
  reseau: ReseauSocial,
  r: { statut: 'publie' | 'echec'; postId?: string | null; erreur?: string | null },
): Promise<void> {
  await getSupabase()
    .from('publications_sociales')
    .update({ statut: r.statut, post_id: r.postId ?? null, erreur: r.erreur?.slice(0, 300) ?? null, termine_le: new Date().toISOString() })
    .eq('cible', cible)
    .eq('cible_id', cibleId)
    .eq('reseau', reseau);
}

/** Marque d'avance ce qui dépasse le plafond : l'article ne partira pas sur ce réseau. */
export async function ignorer(cible: Cible, cibleId: string, reseau: ReseauSocial, raison: string): Promise<void> {
  await getSupabase()
    .from('publications_sociales')
    .upsert(
      { cible, cible_id: cibleId, reseau, statut: 'ignore', erreur: raison, termine_le: new Date().toISOString() },
      { onConflict: 'cible,cible_id,reseau', ignoreDuplicates: true },
    );
}
