/**
 * Après une connexion réussie (code e-mail) : journal des connexions et plafond
 * d'appareils Premium. Appelée par la page de connexion, sans attendre.
 *
 * Session obligatoire ; l'identité vient de la session, la session courante du
 * jeton, le pays de l'en-tête Vercel — rien du corps de la requête. La session
 * courante est toujours gardée : un appel forgé ne peut fermer que d'autres
 * sessions du MÊME compte, ce que l'utilisateur peut déjà faire lui-même.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apresConnexion } from '@/lib/securite/serveur';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { data } = await sb.auth.getClaims();
  const sid = data?.claims?.session_id;
  const r = await apresConnexion({
    userId: user.id,
    email: user.email ?? null,
    sessionId: typeof sid === 'string' ? sid : null,
    entetes: req.headers,
  });
  return new NextResponse(null, { status: r === 'erreur' ? 500 : 204 });
}
