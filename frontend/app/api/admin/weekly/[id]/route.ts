import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server/rbac';
import { updateWeeklyReport } from '@/lib/admin/weekly';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission('content.publish');
  } catch {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    titre?: string;
    resume?: string;
    status?: 'draft' | 'published';
  } | null;

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }

  const patch: { titre?: string; resume?: string; status?: 'draft' | 'published' } = {};
  if (typeof body.titre === 'string') patch.titre = body.titre;
  if (typeof body.resume === 'string') patch.resume = body.resume;
  if (body.status === 'draft' || body.status === 'published') patch.status = body.status;

  try {
    await updateWeeklyReport(params.id, patch);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur interne';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
