// Source de vérité des catégories de cookies (RGPD/ePrivacy).
// Aujourd'hui : seuls des cookies essentiels (session Supabase) sont posés.
// Pour activer un futur analytics : rendre son script conditionnel à
// `has(choice, 'analytics')` (voir lib/consent/state.ts).

export type ConsentCategoryId = 'essential' | 'analytics' | 'marketing';

export interface ConsentCookie {
  name: string;
  purpose: string;
  duration: string;
}

export interface ConsentCategory {
  id: ConsentCategoryId;
  label: string;
  description: string;
  /** Catégorie toujours active, non désactivable (essentiels). */
  required: boolean;
  cookies: ConsentCookie[];
}

/** Incrémenter pour forcer un re-consentement (changement de finalités).
 * Passé à 2 le 2026-07-06 : activation de PostHog (NEXT_PUBLIC_POSTHOG_KEY
 * configurée en prod) — les consentements v1 disaient « aucun outil actif »
 * et ne couvrent pas le session replay. Tous les visiteurs redemandent leur
 * consentement une fois. */
export const CONSENT_VERSION = 2;
export const CONSENT_STORAGE_KEY = `brvm-consent-v${CONSENT_VERSION}`;

export const CONSENT_CATEGORIES: ConsentCategory[] = [
  {
    id: 'essential',
    label: 'Strictement nécessaires',
    description:
      "Indispensables au fonctionnement du site (session de connexion sécurisée). Ils ne peuvent pas être désactivés.",
    required: true,
    cookies: [
      { name: 'sb-access-token', purpose: 'Session authentifiée', duration: 'Session' },
      { name: 'sb-refresh-token', purpose: 'Renouvellement de session', duration: '~1 an' },
    ],
  },
  {
    id: 'analytics',
    label: 'Mesure d’audience',
    description:
      "Statistiques d'usage (PostHog, hébergé en Union européenne) pour comprendre et améliorer le service : pages vues, parcours, replays de session avec saisies masquées. Chargé UNIQUEMENT après votre accord ; retirable à tout moment (arrêt + purge immédiats).",
    required: false,
    cookies: [
      { name: 'ph_* (localStorage)', purpose: "Identifiant de mesure d'audience PostHog", duration: '12 mois' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description:
      "Personnalisation et campagnes. Aucun outil de ce type n'est actif aujourd'hui.",
    required: false,
    cookies: [],
  },
];
