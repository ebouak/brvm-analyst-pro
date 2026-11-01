/**
 * Pays du compte connecté (segmentation commerciale). Session obligatoire ;
 * l'identifiant vient de la session, le pays de l'en-tête Vercel — rien du corps.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enregistrerPays } from '@/lib/crm/geoServeur';

export async function POST(req: Request) {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const r = await enregistrerPays(user.id, req.headers);
  return new NextResponse(null, { status: r === 'erreur' ? 500 : 204 });
}
