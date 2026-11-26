'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { fermerSessions, lireSessionsVivantes } from '@/lib/securite/serveur';
import { regrouperAppareils } from '@/lib/securite/appareils';

/**
 * « Appareils connectés » — fermetures demandées par l'utilisateur lui-même.
 *
 * L'identité vient de la session, jamais du formulaire ; la clé d'appareil
 * reçue n'est qu'un repère, recalculé côté serveur sur les sessions DE CE
 * COMPTE. L'appareil de la page en cours n'est jamais fermé ici : on s'en
 * déconnecte par le bouton habituel.
 */

type R = { ok: true; fermees: number } | { ok: false; message: string };

async function contexte(): Promise<{ userId: string; courante: string | null } | null> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.auth.getClaims();
  const sid = data?.claims?.session_id;
  return { userId: user.id, courante: typeof sid === 'string' ? sid : null };
}

export async function deconnecterAppareil(cle: string): Promise<R> {
  const ctx = await contexte();
  if (!ctx) return { ok: false, message: 'Session expirée : reconnectez-vous.' };
  try {
    const db = getServiceClient();
    const appareils = regrouperAppareils(await lireSessionsVivantes(db, ctx.userId), ctx.courante);
    const a = appareils.find((x) => x.cle === cle);
    if (!a) return { ok: false, message: 'Cet appareil n’est plus connecté.' };
    if (a.courant) return { ok: false, message: 'C’est l’appareil que vous utilisez : utilisez « Se déconnecter ».' };
    const fermees = await fermerSessions(a.sessionIds, 'utilisateur', db);
    revalidatePath('/account/security');
    return { ok: true, fermees };
  } catch {
    return { ok: false, message: 'Déconnexion impossible pour le moment. Réessayez.' };
  }
}

export async function deconnecterAutresAppareils(): Promise<R> {
  const ctx = await contexte();
  if (!ctx) return { ok: false, message: 'Session expirée : reconnectez-vous.' };
  // Sans session courante identifiée, on ne sait pas laquelle garder : on ne ferme rien.
  if (!ctx.courante) return { ok: false, message: 'Appareil en cours non identifié : reconnectez-vous, puis réessayez.' };
  try {
    const db = getServiceClient();
    const appareils = regrouperAppareils(await lireSessionsVivantes(db, ctx.userId), ctx.courante);
    const ids = appareils.filter((a) => !a.courant).flatMap((a) => a.sessionIds);
    const fermees = await fermerSessions(ids, 'utilisateur', db);
    revalidatePath('/account/security');
    return { ok: true, fermees };
  } catch {
    return { ok: false, message: 'Déconnexion impossible pour le moment. Réessayez.' };
  }
}
