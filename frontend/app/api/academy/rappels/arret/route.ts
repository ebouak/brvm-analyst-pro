// Désabonnement « un clic » des rappels de progression Academy (RFC 8058).
//
// La messagerie (Gmail, Outlook…) envoie `POST <URL de List-Unsubscribe>` avec
// le corps `List-Unsubscribe=One-Click`, sans cookie ni session : le jeton de
// l'URL suffit. Un scanner de liens n'émet que des GET : un GET n'arrête donc
// rien, il renvoie vers la page à bouton.
import { NextResponse } from 'next/server';
import { arreterRappelsAcademy } from '@/lib/academy/arretRappels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jeton(req: Request): string {
  return new URL(req.url).searchParams.get('t') ?? '';
}

export async function POST(req: Request) {
  const issue = await arreterRappelsAcademy(jeton(req));
  if (issue === 'erreur') return NextResponse.json({ ok: false }, { status: 503 });
  // Jeton inconnu : 404, pour que la messagerie ne présente pas l'arrêt comme fait.
  if (issue === 'inconnu') return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const url = new URL('/academy/rappels/arret', req.url);
  const t = jeton(req);
  if (t) url.searchParams.set('t', t);
  return NextResponse.redirect(url, 303);
}
