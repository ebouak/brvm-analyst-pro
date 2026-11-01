import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { normaliserReglages, REGLAGES_PAR_DEFAUT, type Reglages } from './reglages';

/**
 * Charge les réglages (service_role : la table n'a aucune policy). Échec de
 * lecture => défauts, séquences éteintes : on dégrade vers le plus prudent.
 * Le journal ne porte jamais de donnée personnelle (code d'erreur seulement).
 */
export async function chargerReglages(): Promise<Reglages> {
  try {
    const { data, error } = await getServiceClient().from('crm_reglages').select('*').eq('id', 1).maybeSingle();
    if (error) {
      console.error('[crm] réglages illisibles, défauts appliqués :', error.code ?? error.message);
      return REGLAGES_PAR_DEFAUT;
    }
    return normaliserReglages(data);
  } catch (e) {
    console.error('[crm] réglages illisibles, défauts appliqués :', (e as Error).name);
    return REGLAGES_PAR_DEFAUT;
  }
}
