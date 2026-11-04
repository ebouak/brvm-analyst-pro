import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import type { EntreeCache, StockageRecherche } from '@/lib/recherche/orchestrer';
import type { CleCache, ResultatJevValide } from '@/lib/recherche/types';

const DUREE_CACHE_MS = 24 * 3600 * 1000;

/** Cache, verrou et budget de la recherche : service_role seul (RLS sans policy). */
export function stockageSupabase(): StockageRecherche {
  const db = getServiceClient();
  const table = () => db.from('recherche_societes_cache');

  return {
    async lire(cle: CleCache): Promise<EntreeCache | null> {
      const { data, error } = await table()
        .select('etat, resultat, cree_le')
        .eq('empreinte', cle.empreinte)
        .eq('snapshot_id', cle.snapshotId)
        .maybeSingle();
      if (error) throw new Error('cache_lecture');
      if (!data) return null;
      if (data.etat === 'prete' && Date.now() - new Date(data.cree_le as string).getTime() > DUREE_CACHE_MS) return null;
      return { etat: data.etat as EntreeCache['etat'], resultat: (data.resultat as ResultatJevValide | null) ?? null };
    },
    async verrouiller(cle) {
      const { data, error } = await db.rpc('recherche_verrouiller', { p_empreinte: cle.empreinte, p_snapshot: cle.snapshotId });
      if (error) throw new Error('cache_verrou');
      return data === true;
    },
    async ecrire(cle, resultat) {
      const { error } = await table()
        .update({ etat: 'prete', resultat, pertinence_globale: resultat.pertinenceGlobale, cree_le: new Date().toISOString() })
        .eq('empreinte', cle.empreinte)
        .eq('snapshot_id', cle.snapshotId);
      if (error) throw new Error('cache_ecriture');
      // Minimisation : purge des entrées expirées à chaque écriture.
      await table().delete().lt('cree_le', new Date(Date.now() - DUREE_CACHE_MS).toISOString());
    },
    async liberer(cle) {
      await table().delete().eq('empreinte', cle.empreinte).eq('snapshot_id', cle.snapshotId).eq('etat', 'en_cours');
    },
  };
}

/** Réservation atomique d'un appel Jev dans le plafond du jour. */
export async function reserverBudgetRecherche(plafond: number): Promise<'ok' | 'refuse' | 'erreur'> {
  const { data, error } = await getServiceClient().rpc('recherche_reserver_budget', { p_plafond: plafond });
  if (error) return 'erreur';
  return data === true ? 'ok' : 'refuse';
}
