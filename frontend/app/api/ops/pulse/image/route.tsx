import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { verifierPulse } from '@/lib/opsAgent/pulseSignature';
import { chargerPulseData } from '@/lib/opsAgent/pulseDonnees';
import { imagePulse } from '@/lib/opsAgent/pulseRendu';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const NON_CACHE = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const secret = process.env.OPS_PULSE_SECRET || process.env.RECAP_SECRET;
  const ok = await verifierPulse({ exp: p.get('exp'), sig: p.get('sig') }, secret);

  if (!ok) {
    return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 401, headers: NON_CACHE });
  }

  try {
    const data = await chargerPulseData(getServiceClient());
    return imagePulse(data);
  } catch (err) {
    console.error('ops/pulse/image: erreur rendu', {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Rendu indisponible.' }, { status: 503, headers: NON_CACHE });
  }
}
