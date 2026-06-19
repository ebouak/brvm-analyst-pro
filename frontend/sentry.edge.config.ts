// Sentry — initialisation côté Edge runtime (middleware, routes edge).
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: process.env.NODE_ENV === 'production' && !!dsn,
  tracesSampleRate: 0.1,
});
