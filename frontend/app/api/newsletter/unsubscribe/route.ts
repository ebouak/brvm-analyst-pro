import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/billing/serviceClient';

export const dynamic = 'force-dynamic';

function page(message: string): NextResponse {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Désabonnement</title></head>` +
    `<body style="font-family:sans-serif;background:#0b0b0d;color:#eee;display:grid;place-items:center;height:100vh;margin:0">` +
    `<div style="text-align:center;max-width:420px;padding:24px"><h1 style="color:#56d7fd">WESTBOURSE</h1><p>${message}</p></div></body></html>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

type Resultat = { ok: true } | { ok: false; message: string; status: number };

async function desabonner(token: string | null): Promise<Resultat> {
  if (!token) return { ok: false, message: 'Lien de désabonnement invalide.', status: 400 };
  let db;
  try {
    db = getServiceClient();
  } catch {
    return { ok: false, message: 'Service indisponible.', status: 503 };
  }
  // .select('id') (pas 'email') : on a juste besoin de savoir si une ligne a matché.
  const { data, error } = await db
    .from('newsletter_subscribers')
    .update({ confirmed: false })
    .eq('confirm_token', token)
    .select('id');
  if (error) return { ok: false, message: 'Une erreur est survenue. Réessayez plus tard.', status: 500 };
  if (!data || data.length === 0) return { ok: false, message: 'Lien de désabonnement inconnu ou déjà utilisé.', status: 404 };
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const r = await desabonner(req.nextUrl.searchParams.get('token'));
  return page(r.ok ? 'Vous êtes désabonné de la newsletter. À bientôt.' : r.message);
}

/**
 * Désabonnement en un clic (RFC 8058) : le client de messagerie envoie
 * `List-Unsubscribe=One-Click` en POST sur l'URL de l'en-tête List-Unsubscribe.
 * Le jeton reste dans la query string de cette URL.
 */
export async function POST(req: NextRequest) {
  const r = await desabonner(req.nextUrl.searchParams.get('token'));
  if (!r.ok) return NextResponse.json({ error: r.message }, { status: r.status });
  return NextResponse.json({ ok: true });
}
