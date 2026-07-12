import 'server-only';
import { headers } from 'next/headers';
import { getServiceClient } from '@/lib/billing/serviceClient';

/**
 * Journal des connexions (IP, appareil).
 *
 * On enregistre aussi les ÉCHECS : une série de tentatives ratées sur un compte
 * est le signal d'attaque le plus utile, et c'est précisément ce qu'on ne voyait
 * pas jusqu'ici.
 *
 * N'échoue JAMAIS l'action métier : un incident de journalisation ne doit pas
 * empêcher un utilisateur légitime de se connecter.
 */

export type AuthEventType = 'sign_in' | 'sign_in_failed' | 'sign_out' | 'password_reset';

export async function recordAuthEvent(entry: {
  event: AuthEventType;
  userId?: string | null;
  email?: string | null;
}): Promise<void> {
  try {
    const h = headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const ua = h.get('user-agent') ?? null;

    await getServiceClient().from('auth_events').insert({
      user_id: entry.userId ?? null,
      email: entry.email?.toLowerCase().trim() ?? null,
      event: entry.event,
      ip_address: ip,
      user_agent: ua,
    });
  } catch {
    // Journalisation best-effort : jamais bloquante.
  }
}
