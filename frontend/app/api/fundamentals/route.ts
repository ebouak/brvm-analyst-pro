import { NextResponse } from 'next/server';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { requireAdminApi } from '@/lib/server/adminApi';

/**
 * POST /api/fundamentals — correction manuelle des fondamentaux + shares.
 * RÉSERVÉ admin (permission content.write) ET session élevée 2FA : cette route
 * écrit avec la clé service_role dans les états financiers de toute société ;
 * elle était auparavant ouverte à n'importe quel compte connecté.
 * Marque is_manual=true (fundamentals) et shares_source='manual' (instruments).
 * Refuse d'écraser une ligne `pdf-verified` (référence validée sur PDF).
 */
const CODE_RE = /^[A-Z]{2,5}$/;
const CHAMPS_NUM = ['revenue', 'net_income', 'equity', 'debt', 'shares', 'eps', 'dividend_per_share'] as const;

export async function POST(req: Request) {
  // 1) Admin + permission + 2FA, AVANT toute création de client service_role.
  const g = await requireAdminApi('content.write');
  if ('error' in g) return g.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.code !== 'string') {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const code = body.code.toUpperCase();
  if (!CODE_RE.test(code)) return NextResponse.json({ error: 'Code invalide' }, { status: 400 });
  const { year, revenue, net_income, equity, debt, shares, eps, dividend_per_share } = body;

  // Nombres finis ou null/absents ; année entière plausible.
  for (const k of CHAMPS_NUM) {
    const v = body[k];
    if (v != null && (typeof v !== 'number' || !Number.isFinite(v))) {
      return NextResponse.json({ error: `Valeur invalide : ${k}` }, { status: 400 });
    }
  }
  if (year != null && (!Number.isInteger(year) || year < 1990 || year > 2100)) {
    return NextResponse.json({ error: 'Année invalide' }, { status: 400 });
  }

  // 2) Écriture service_role.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return NextResponse.json({ error: 'Service indisponible' }, { status: 500 });
  const admin = createSbClient(url, key);

  // 3) Le code doit exister (sinon on créerait des lignes orphelines).
  const { data: inst } = await admin.from('brvm_instruments').select('code').eq('code', code).maybeSingle();
  if (!inst) return NextResponse.json({ error: 'Valeur inconnue' }, { status: 404 });

  // 4) Jamais d'écrasement d'une référence vérifiée sur PDF.
  if (year != null) {
    const { data: ref } = await admin.from('fundamentals').select('source')
      .eq('code', code).eq('year', year).maybeSingle();
    if (ref?.source === 'pdf-verified') {
      return NextResponse.json({ error: 'Exercice vérifié sur PDF : correction manuelle refusée.' }, { status: 409 });
    }
  }

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
