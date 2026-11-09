import { createPublicClient } from '@/lib/supabase/public';
import { ligneValide, type LigneFacteurs } from './facteurs';

/**
 * Dernière séance de conseiller_facteurs. LÈVE si la lecture échoue : une
 * panne n'est pas une table vide, et la page doit dire laquelle des deux.
 * Renvoie `null` si la table est vide.
 */
export async function lirePositions(): Promise<{ date: string; lignes: LigneFacteurs[] } | null> {
  const sb = createPublicClient();
  const { data: der, error: e1 } = await sb
    .from('conseiller_facteurs')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  if (e1) throw new Error(`conseiller_facteurs illisible : ${e1.message}`);
  const date = der?.[0]?.date_marche as string | undefined;
  if (!date) return null;
  const { data, error } = await sb
    .from('conseiller_facteurs')
    .select('code, date_marche, tiers, effectifs, classe_liquidite')
    .eq('date_marche', date)
    .order('code');
  if (error) throw new Error(`conseiller_facteurs illisible : ${error.message}`);
  const lignes = ((data ?? []) as LigneFacteurs[]).filter(ligneValide);
  return { date, lignes };
}
