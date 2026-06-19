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
  // Session Replay retiré pour alléger le bundle client (perf mobile).
  // Réactivable plus tard via Sentry.replayIntegration() si besoin de debug visuel.
});
