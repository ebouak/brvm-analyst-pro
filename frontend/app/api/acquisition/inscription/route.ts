import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { estInscriptionRecente, normaliserSrc } from '@/lib/acquisition/suivi';
import { incrementerAcquisition } from '@/lib/acquisition/compteur';

export const dynamic = 'force-dynamic';

/**
 * Fin d'inscription par code e-mail venue d'un lien de campagne (/signup?src=).
 * Compte une inscription AGRÉGÉE sous la source — rien n'est rattaché au compte,
 * aucune colonne n'est écrite dans profiles. Session exigée, et compte créé il y
 * a moins de 30 min : une simple connexion ne compte pas.
 * Avec session, réponse toujours 204 (compté ou non) : la page n'a rien à faire d'un échec.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  let src: unknown;
  try {
    src = ((await request.json()) as { src?: unknown })?.src;
  } catch {
    src = undefined;
  }
  if (estInscriptionRecente(user.created_at, new Date())) {
    await incrementerAcquisition(normaliserSrc(src), 'inscription');
  }
  return new NextResponse(null, { status: 204 });
}
