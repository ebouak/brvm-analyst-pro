import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * WhatsApp liés à un compte (migration 0165 : table whatsapp_liaisons, au
 * plus MAX_LIAISONS par compte). Chaque identifiant est PROUVÉ par code
 * d'appairage. Chaque WhatsApp lié reçoit tout et peut tout demander.
 *
 * Repli sur l'ancienne colonne notification_prefs.whatsapp_chat_id (0162)
 * tant que la migration n'est pas appliquée (table absente) : un déploiement
 * en avance sur la base ne coupe personne.
 */
export const MAX_LIAISONS = 2;

export const TABLE_ABSENTE = new Set(['42P01', 'PGRST205']);

/** Compte propriétaire de cette conversation WhatsApp, sinon null. */
export async function userParChat(db: SupabaseClient, chatId: string): Promise<string | null> {
  const { data, error } = await db.from('whatsapp_liaisons').select('user_id').eq('chat_id', chatId).maybeSingle();
  if (!error) return (data?.user_id as string | undefined) ?? null;
  if (!TABLE_ABSENTE.has(error.code ?? '')) throw new Error(`liaisons : ${error.code ?? error.message}`);
  const { data: ancien } = await db.from('notification_prefs').select('user_id').eq('whatsapp_chat_id', chatId).maybeSingle();
  return (ancien?.user_id as string | undefined) ?? null;
}

/** Ce compte, lié à ce WhatsApp, a-t-il consenti (whatsapp_optin + le drapeau demandé) ? */
export async function compteConsentant(
  db: SupabaseClient,
  chatId: string,
  drapeau?: 'agent_optin',
): Promise<string | null> {
  const userId = await userParChat(db, chatId);
  if (!userId) return null;
  const { data } = await db.from('notification_prefs').select('whatsapp_optin, agent_optin').eq('user_id', userId).maybeSingle();
  if (!data?.whatsapp_optin) return null;
  if (drapeau && !data[drapeau]) return null;
  return userId;
}
