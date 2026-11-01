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

  // Pas de consentement sans moyen de contact : numéro valide fourni, ou compte
  // déjà lié par appairage. Lecture en échec : on n'enregistre pas le consentement.
  let consentir = false;
  if (recontact) {
    if (tel.e164) {
      consentir = true;
    } else {
      const [{ data: prefs, error: e1 }, { count, error: e2 }] = await Promise.all([
        sb.from('notification_prefs').select('whatsapp_optin, whatsapp_chat_id').eq('user_id', user.id).maybeSingle(),
        sb.from('whatsapp_liaisons').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);
      consentir = !e1 && !e2 && (Boolean(prefs?.whatsapp_optin && prefs?.whatsapp_chat_id) || (count ?? 0) > 0);
    }
  }

  const { error } = await sb.from('notification_prefs').upsert(
    {
      user_id: user.id,
      ecran_whatsapp_vu_at: maintenant,
      ...(tel.e164 ? { telephone_declare: tel.e164 } : {}),
      // Case décochée ou sans moyen de contact : on ne touche pas à un consentement déjà donné.
      ...(consentir ? { recontact_optin_at: maintenant } : {}),
    },
    { onConflict: 'user_id' },
  );
  return error ? { ok: false, message: 'Enregistrement impossible : réessayez.' } : { ok: true };
}
