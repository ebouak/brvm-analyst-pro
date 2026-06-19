// Sentry — initialisation côté navigateur (chargée automatiquement par @sentry/nextjs).
// Le DSN n'est PAS un secret (il sert uniquement à émettre des événements).
// Actif uniquement en production et si le DSN est défini → pas de bruit en dev.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: process.env.NODE_ENV === 'production' && !!dsn,
  // Traçage des performances : 10 % en prod (quota maîtrisé).
  tracesSampleRate: 0.1,
  // Session Replay : 10 % des sessions, 100 % de celles avec erreur.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
});
