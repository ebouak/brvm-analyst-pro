import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { requirePermission } from '@/lib/server/rbac';
import { identifiantsClient } from '@/lib/server/social';
import { cheminRetour, estReseau, urlAutorisation } from '@/lib/social/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lance la connexion OAuth d'un réseau. Le `state` aléatoire part dans un
 * cookie httpOnly limité aux routes /api/admin/reseaux (10 min) : la route de
 * retour refuse tout code qui ne le rapporte pas (CSRF de connexion).
 * `sameSite: lax` est nécessaire — le retour est une navigation de premier
 * niveau depuis LinkedIn ou TikTok, `strict` y perdrait le cookie.
 */
export async function GET(req: NextRequest, { params }: { params: { reseau: string } }) {
  await requirePermission('content.publish');
  const r = params.reseau;
  if (!estReseau(r)) return NextResponse.json({ erreur: 'Réseau inconnu.' }, { status: 404 });
  const origine = req.nextUrl.origin;
  const client = identifiantsClient(r);
  if (!client) return NextResponse.redirect(`${origine}/admin/reseaux?erreur=${encodeURIComponent(`${r} : identifiants d'application absents`)}`);

  const state = randomBytes(24).toString('base64url');
  const res = NextResponse.redirect(urlAutorisation(r, { clientId: client.id, redirectUri: `${origine}${cheminRetour(r)}`, state }));
  res.cookies.set(`ws_oauth_${r}`, state, {
    httpOnly: true,
    secure: origine.startsWith('https://'),
    sameSite: 'lax',
    path: '/api/admin/reseaux',
    maxAge: 600,
  });
  return res;
}
