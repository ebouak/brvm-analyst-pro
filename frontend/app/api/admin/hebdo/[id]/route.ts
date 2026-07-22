import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await requirePermission('content.publish');
  const body = (await req.json()) as { statut?: 'brouillon' | 'publie' };
  if (body.statut !== 'brouillon' && body.statut !== 'publie') {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
  }
  const svc = getServiceClient();
  const { error } = await svc
    .from('hebdo_editions')
    .update({ statut: body.statut, published_at: body.statut === 'publie' ? new Date().toISOString() : null })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: 'Échec' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
