import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/billing/serviceClient';

export const dynamic = 'force-dynamic';

function page(message: string): NextResponse {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Désabonnement</title></head>` +
    `<body style="font-family:sans-serif;background:#0b0b0d;color:#eee;display:grid;place-items:center;height:100vh;margin:0">` +
    `<div style="text-align:center;max-width:420px;padding:24px"><h1 style="color:#56d7fd">WESTBOURSE</h1><p>${message}</p></div></body></html>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return page('Lien de désabonnement invalide.');
  let db;
  try {
    db = getServiceClient();
  } catch {
    return page('Service indisponible.');
  }
  // .select('id') (pas 'email') : on a juste besoin de savoir si une ligne a matché.
  const { data, error } = await db
    .from('newsletter_subscribers')
    .update({ confirmed: false })
    .eq('confirm_token', token)
    .select('id');
  if (error) return page('Une erreur est survenue. Réessayez plus tard.');
  if (!data || data.length === 0) return page('Lien de désabonnement inconnu ou déjà utilisé.');
  return page('Vous êtes désabonné de la newsletter. À bientôt.');
}
