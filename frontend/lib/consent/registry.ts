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

/** Incrémenter pour forcer un re-consentement (changement de finalités). */
export const CONSENT_VERSION = 1;
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
      "Statistiques de fréquentation anonymisées pour améliorer le service. Aucun outil de ce type n'est actif aujourd'hui.",
    required: false,
    cookies: [],
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
