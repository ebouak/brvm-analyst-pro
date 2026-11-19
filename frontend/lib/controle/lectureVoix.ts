import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import type { LigneAppelVocal } from './voix';

/**
 * Chargeur « appels vocaux » de la Tour de contrôle. LÈVE si la table est
 * illisible (absente avant la migration 0250 comprise) : la page en fait un
 * signal « inconnu », jamais un vert. Volume borné par le plafond quotidien
 * (VOIX_MAX_JOUR) : 30 jours tiennent largement sous 1000 lignes.
 */
export async function chargerAppelsVocaux(maintenant = new Date()): Promise<LigneAppelVocal[]> {
  const depuis = new Date(maintenant.getTime() - 30 * 86_400_000).toISOString();
  const { data, error } = await getServiceClient()
    .from('appels_vocaux')
    .select('id, motif, source_id, statut, erreur, cree_le')
    .or(`cree_le.gte."${depuis}",statut.in.(en_cours,en_file,peut_etre_parti)`)
    .order('cree_le', { ascending: false })
    .limit(1000);
  if (error) throw new Error(`appels_vocaux : ${error.message}`);
  return (data ?? []) as LigneAppelVocal[];
}
