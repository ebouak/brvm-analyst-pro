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
  const { code, year, revenue, net_income, equity, debt, shares, eps, dividend_per_share } = body;

  // 2) Écriture service_role.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return NextResponse.json({ error: 'Service indisponible' }, { status: 500 });
  const admin = createSbClient(url, key);

  if (year != null) {
    // Table fundamentals (résumé simple)
    const { error: e1 } = await admin.from('fundamentals').upsert(
      { code, year, revenue, net_income, equity, debt, is_manual: true, source: 'import-ia' },
      { onConflict: 'code,year' },
    );
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

    const periode = String(year);

    // income_statements — alimente revenu_total + resultat_net + BPA + dividende
    const { error: e2 } = await admin.from('income_statements').upsert(
      {
        code, periode, type_periode: 'annuel',
        revenu_total:  revenue  ?? null,
        resultat_net:  net_income ?? null,
        benefice_par_action: eps ?? null,
        dividende_par_action: dividend_per_share ?? null,
        actions_en_circulation: shares ?? null,
      },
      { onConflict: 'code,periode,type_periode' },
    );
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

    // balance_sheets — alimente capitaux propres + dette
    const { error: e3 } = await admin.from('balance_sheets').upsert(
      {
        code, periode, type_periode: 'annuel',
        total_capitaux_propres: equity ?? null,
        dette_long_terme: debt ?? null,
        total_actifs: equity != null && debt != null ? equity + debt : null,
      },
      { onConflict: 'code,periode,type_periode' },
    );
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });
  }

  if (shares != null) {
    const { error } = await admin.from('brvm_instruments')
      .update({ shares, shares_source: 'import-ia' }).eq('code', code);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
