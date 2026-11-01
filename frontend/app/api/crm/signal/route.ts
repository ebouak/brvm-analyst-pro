/**
 * Balise « a consulté l'offre » / « a consulté la formation ». Appelée par <SignalOffre> AU MONTAGE, jamais
 * au rendu serveur : Next précharge /pricing et /premium/upgrade sans que la
 * personne voie la page (revue Fable du 2026-10-31). Une ligne par jour et par
 * page ; rien pour un visiteur anonyme ni pour une personne opposée.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { typeDePage } from '@/lib/crm/signal';
import { estOppose } from '@/lib/crm/opposition';

export async function POST(req: Request) {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user?.email) return new NextResponse(null, { status: 204 });
  let page: unknown;
  try { page = ((await req.json()) as { page?: unknown })?.page; } catch { return new NextResponse(null, { status: 400 }); }
  // Le type vient de la page validée, jamais du client ; même motif que le CHECK de la base.
  const type = typeDePage(page);
  if (!type) return new NextResponse(null, { status: 400 });
  let oppose: boolean;
  try { oppose = await estOppose(user.email); } catch (e) {
    console.error('crm_signal : opposition illisible, rien écrit', e instanceof Error ? e.message : e);
    return new NextResponse(null, { status: 500 });
  }
  if (oppose) return new NextResponse(null, { status: 204 });
  const { error } = await getServiceClient()
    .from('crm_signaux')
    .upsert({ user_id: user.id, type, page }, { onConflict: 'user_id,page,jour', ignoreDuplicates: true });
  if (error) {
    console.error('crm_signal : écriture refusée', error.code);
    return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
