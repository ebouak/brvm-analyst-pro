import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { normaliserSrc, type Evenement } from './suivi';

/**
 * Incrément du compteur agrégé `acquisition_compteurs` (migration 0251), côté
 * serveur et en service_role : la fonction est révoquée pour public, anon et
 * authenticated. Ne lève JAMAIS : une redirection ou une inscription ne doit pas
 * dépendre d'une statistique. L'échec est journalisé sans rien de personnel
 * (la source est une étiquette de campagne).
 */
export async function incrementerAcquisition(src: string, evenement: Evenement): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) {
    console.error('[acquisition] service_role absente : compteur non incrémenté');
    return false;
  }
  try {
    const db = createClient(url, cle, { auth: { persistSession: false } });
    const { error } = await db.rpc('acquisition_incrementer', { p_src: normaliserSrc(src), p_evenement: evenement });
    if (error) {
      console.error('[acquisition] incrément refusé', { evenement, code: error.code, message: error.message });
      return false;
    }
    return true;
  } catch (e) {
    console.error('[acquisition] incrément en échec', { evenement, message: e instanceof Error ? e.message : String(e) });
    return false;
  }
}
