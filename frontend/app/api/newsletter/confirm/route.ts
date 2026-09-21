import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/billing/serviceClient';

/**
 * Confirmation d'inscription à la newsletter (double opt-in).
 *
 * Miroir de ../unsubscribe : même jeton `confirm_token`, même page minimale.
 * Le jeton est un uuid tiré par la base (0037) : un lien deviné n'a aucune
 * chance raisonnable d'aboutir. Un jeton inconnu répond la même page qu'un
 * jeton déjà confirmé — on ne révèle pas si une adresse existe.
 */
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function page(message: string): NextResponse {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Inscription newsletter</title></head>` +
    `<body style="font-family:sans-serif;background:#0b0b0d;color:#eee;display:grid;place-items:center;height:100vh;margin:0">` +
    `<div style="text-align:center;max-width:420px;padding:24px"><h1 style="color:#56d7fd">WESTBOURSE</h1><p>${message}</p>` +
    `<p><a href="/" style="color:#56d7fd">Retour au site</a></p></div></body></html>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token || !UUID.test(token)) return page('Lien de confirmation invalide.');
  let db;
  try {
    db = getServiceClient();
  } catch {
    return page('Service indisponible.');
  }
  // Ne touche que les lignes non confirmées : un second clic ne réécrit pas confirmed_at.
  const { data, error } = await db
    .from('newsletter_subscribers')
    .update({ confirmed: true, confirmed_at: new Date().toISOString() })
    .eq('confirm_token', token)
    .eq('confirmed', false)
    .select('id');
  if (error) return page('Une erreur est survenue. Réessayez plus tard.');
  if (!data || data.length === 0) return page('Lien inconnu, ou inscription déjà confirmée.');
  return page('Inscription confirmée. Vous recevrez la prochaine lettre WESTBOURSE.');
}
