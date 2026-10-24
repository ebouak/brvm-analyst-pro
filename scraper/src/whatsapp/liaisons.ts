/**
 * WhatsApp liés par compte (migration 0165, au plus 2) — chacun reçoit TOUT
 * (point du soir, alertes, dossiers, récap). Identifiants PROUVÉS par code
 * d'appairage ; jamais un numéro saisi.
 *
 * Repli sur l'ancienne colonne notification_prefs.whatsapp_chat_id (0162)
 * tant que la migration n'est pas appliquée : aucun abonné n'est perdu.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const TABLE_ABSENTE = new Set(['42P01', 'PGRST205']);

export async function chatsParUtilisateur(sb: SupabaseClient, userIds: string[]): Promise<Map<string, string[]>> {
  const carte = new Map<string, string[]>();
  if (userIds.length === 0) return carte;
  const ajouter = (u: string, c: string | null) => {
    if (!c) return;
    if (!carte.has(u)) carte.set(u, []);
    if (!carte.get(u)!.includes(c)) carte.get(u)!.push(c);
  };

  const { data, error } = await sb.from('whatsapp_liaisons').select('user_id, chat_id').in('user_id', userIds);
  if (!error) {
    for (const l of (data ?? []) as { user_id: string; chat_id: string }[]) ajouter(l.user_id, l.chat_id);
    return carte;
  }
  if (!TABLE_ABSENTE.has(error.code ?? '')) throw new Error(`whatsapp_liaisons : ${error.code ?? error.message}`);

  const { data: anciens } = await sb.from('notification_prefs').select('user_id, whatsapp_chat_id').in('user_id', userIds);
  for (const p of (anciens ?? []) as { user_id: string; whatsapp_chat_id: string | null }[]) ajouter(p.user_id, p.whatsapp_chat_id);
  return carte;
}
