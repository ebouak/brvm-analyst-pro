import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';

export const dynamic = 'force-dynamic';

/** Statuts qu'un administrateur peut poser. `a_valider` n'est posé que par le scraper. */
const STATUTS = new Set(['publie', 'rejete', 'brouillon']);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await requirePermission('content.publish');
  const body = (await req.json().catch(() => ({}))) as { statut?: string };
  if (!body.statut || !STATUTS.has(body.statut)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
  }
  const maintenant = new Date().toISOString();
  const { error } = await getServiceClient()
    .from('articles')
    .update({ statut: body.statut, publie_le: body.statut === 'publie' ? maintenant : null, updated_at: maintenant })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: 'Échec' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
