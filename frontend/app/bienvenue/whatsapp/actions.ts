'use server';
import { createClient } from '@/lib/supabase/server';
import { normaliserTelephone } from '@/lib/crm/telephone';

type Retour = { ok: boolean; message?: string };

/**
 * Ferme l'écran pour de bon ; enregistre le numéro déclaré et le consentement
 * s'ils sont fournis. RLS owner (clé de session). N'écrit JAMAIS les colonnes
 * de liaison prouvée (whatsapp_phone, whatsapp_chat_id, …) : verrou 0162.
 */
export async function terminerEcran(numero: string, recontact: boolean): Promise<Retour> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, message: 'Session expirée : reconnectez-vous.' };
  const tel = normaliserTelephone(numero ?? '');
  if (!tel.ok) return { ok: false, message: tel.erreur };
  const maintenant = new Date().toISOString();
  const { error } = await sb.from('notification_prefs').upsert(
    {
      user_id: user.id,
      ecran_whatsapp_vu_at: maintenant,
      ...(tel.e164 ? { telephone_declare: tel.e164 } : {}),
      // Case décochée : on ne touche pas à un consentement déjà donné.
      ...(recontact ? { recontact_optin_at: maintenant } : {}),
    },
    { onConflict: 'user_id' },
  );
  return error ? { ok: false, message: 'Enregistrement impossible : réessayez.' } : { ok: true };
}
