import 'server-only';
import { PostHog } from 'posthog-node';

/**
 * Capture d'événements SERVEUR (ex. activation Premium par l'admin — aucun
 * navigateur impliqué, donc aucun événement client possible). Même clé de
 * projet que le client (PostHog : une seule clé, client et serveur — pas de
 * "write key" séparée) ; `distinctId` DOIT être le même id que celui utilisé
 * par `phIdentify` côté client (l'UUID Supabase de l'utilisateur) pour que
 * PostHog fusionne les deux dans un seul profil.
 *
 * Base légale RGPD : ceci n'est PAS de la mesure d'audience (hors périmètre
 * du bandeau cookies) — c'est un événement de gestion d'abonnement, sur un
 * client déjà identifié par contrat, comparable aux écritures déjà faites
 * dans `subscriptions`/`billing_transactions`. Voir docs/RGPD.md.
 *
 * Contexte serverless (Vercel) : flush explicite après chaque capture, la
 * fonction pouvant se terminer avant l'envoi réseau asynchrone. Jamais
 * bloquant pour l'action métier : toute erreur est avalée.
 */
let client: PostHog | null | undefined;

function getClient(): PostHog | null {
  if (client !== undefined) return client;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  client = key
    ? new PostHog(key, {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
        flushAt: 1,
        flushInterval: 0,
      })
    : null;
  return client;
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    c.capture({ distinctId, event, properties });
    await c.flush();
  } catch {
    // Analytics best-effort — ne doit jamais faire échouer l'action métier.
  }
}
