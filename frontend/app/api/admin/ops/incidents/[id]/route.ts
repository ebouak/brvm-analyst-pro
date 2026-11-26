import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/server/adminApi';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { prendreEnChargeIncident, resoudreIncident, silencierIncident } from '@/lib/opsAgent/escalade';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdminApi('scraping.retry');
  if ('error' in g) return g.error;

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Identifiant incident invalide.' }, { status: 400 });
  }

  const corps = (await req.json().catch(() => null)) as { action?: string; note?: string } | null;
  const action = corps?.action;
  if (!action || !['ack', 'silence', 'resolve'].includes(action)) {
    return NextResponse.json({ error: 'Action invalide.' }, { status: 400 });
  }

  const db = getServiceClient();
  let res: { ok: boolean; html: string };
  if (action === 'ack') {
    res = await prendreEnChargeIncident(db, id, 0);
  } else if (action === 'silence') {
    res = await silencierIncident(db, id, 6, 0);
  } else {
    res = await resoudreIncident(db, id, corps?.note?.trim() || 'Résolu depuis console admin', 0);
  }

  await recordAudit(g.ctx, {
    action: `ops.incident.${action}`,
    resourceType: 'ops_incident',
    resourceId: id,
    severity: 'info',
    metadata: { ok: res.ok },
  });

  if (!res.ok) return NextResponse.json({ error: 'Incident introuvable ou déjà clos.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
