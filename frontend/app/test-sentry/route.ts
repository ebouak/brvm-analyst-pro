// ROUTE DE TEST TEMPORAIRE — à supprimer après validation de Sentry.
// Visiter /test-sentry en PRODUCTION déclenche une erreur volontaire :
//  1. capturée explicitement (Sentry.captureException + flush),
//  2. relancée pour exercer aussi le hook onRequestError.
// En dev, Sentry est désactivé (enabled: production only) → rien n'est envoyé.
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const err = new Error('Sentry test — WESTBOURSE (route /test-sentry)');
  Sentry.captureException(err);
  await Sentry.flush(2000);
  throw err;
}
