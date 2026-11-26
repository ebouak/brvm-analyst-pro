import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/server/adminApi';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { sonderSanteCanaux } from '@/lib/opsAgent/controles';

export const dynamic = 'force-dynamic';

export async function GET() {
  const g = await requireAdminApi('scraping.read');
  if ('error' in g) return g.error;

  const sondes = await sonderSanteCanaux(getServiceClient());
  return NextResponse.json({ ok: true, observeA: new Date().toISOString(), sondes });
}
