'use client';

/**
 * Wrapper mince autour de posthog-js pour le reste de l'app — même import
 * dynamique et même porte de consentement que PostHogInit (qui appelle
 * markPostHogReady() une fois posthog.init() résolu après accord de
 * l'utilisateur). Tant que non prêt, tout appel est un no-op silencieux :
 * jamais d'erreur, jamais de capture avant consentement.
 */
let ready = false;

export function markPostHogReady() {
  ready = true;
}
export function markPostHogNotReady() {
  ready = false;
}

/** Relie l'activité anonyme pré-connexion au profil identifié (fusion PostHog automatique). */
export async function phIdentify(userId: string, props?: Record<string, unknown>) {
  if (!ready) return;
  const { default: posthog } = await import('posthog-js');
  posthog.identify(userId, props);
}

export async function phCapture(event: string, props?: Record<string, unknown>) {
  if (!ready) return;
  const { default: posthog } = await import('posthog-js');
  posthog.capture(event, props);
}

/** À appeler à la déconnexion : évite d'attribuer la session suivante (poste partagé) à la même personne. */
export async function phReset() {
  if (!ready) return;
  const { default: posthog } = await import('posthog-js');
  posthog.reset();
}
