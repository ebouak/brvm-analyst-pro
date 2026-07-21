import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';

export const dynamic = 'force-dynamic';

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });
  // Révocation via service_role (pas de policy UPDATE authenticated) ; appartenance vérifiée ici.
  const svc = getServiceClient();
  const { error } = await svc.from('academy_certificates').update({ revoked: true }).eq('id', params.id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Échec' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
