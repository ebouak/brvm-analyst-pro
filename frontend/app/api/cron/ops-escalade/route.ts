import { NextResponse } from 'next/server';
import { cronAutorise } from '@/lib/server/cronAuth';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { traiterEscaladesDues } from '@/lib/opsAgent/escalade';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!cronAutorise(req)) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 });
  }

  const res = await traiterEscaladesDues(getServiceClient());
  return NextResponse.json({ ok: true, ...res });
}
