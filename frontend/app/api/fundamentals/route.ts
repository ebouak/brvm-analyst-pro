import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSbClient } from '@supabase/supabase-js';

/**
 * POST /api/fundamentals — correction manuelle des fondamentaux + shares.
 * Authentifié (utilisateur connecté). Écrit via service_role (jamais exposé client).
 * Marque is_manual=true (fundamentals) et shares_source='manual' (instruments).
 */
export async function POST(req: Request) {
  // 1) Auth : utilisateur connecté requis.
  const supa = createServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.code !== 'string') {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const { code, year, revenue, net_income, equity, debt, shares } = body;

  // 2) Écriture service_role.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return NextResponse.json({ error: 'Service indisponible' }, { status: 500 });
  const admin = createSbClient(url, key);

  if (year != null) {
    const { error } = await admin.from('fundamentals').upsert(
      { code, year, revenue, net_income, equity, debt, is_manual: true, source: 'manuel' },
      { onConflict: 'code,year' },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (shares != null) {
    const { error } = await admin.from('brvm_instruments')
      .update({ shares, shares_source: 'manual' }).eq('code', code);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
