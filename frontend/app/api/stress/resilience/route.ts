import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canAccess } from '@/lib/server/featureAccess';
import { chargerResilienceScanner } from '@/lib/stress/lectureResilience';

const QuerySchema = z.object({
  secteur: z.string().trim().max(80).optional(),
  pays: z.string().trim().max(60).optional(),
  classement: z.enum(['tous', 'A', 'C', 'decrochages']).default('tous'),
  format: z.enum(['json', 'csv']).default('json'),
});

const csvEscape = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(request: Request) {
  const access = await canAccess('stress_scanner');
  if (!access.allowed) {
    return NextResponse.json(
      { error: 'Accès Premium requis pour le Stock Resilience Scanner', required: access.required },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    secteur: searchParams.get('secteur') ?? undefined,
    pays: searchParams.get('pays') ?? undefined,
    classement: searchParams.get('classement') ?? 'tous',
    format: searchParams.get('format') ?? 'json',
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres invalides', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { secteur, pays, classement, format } = parsed.data;
  const data = await chargerResilienceScanner();

  let actions = data.actions;
  if (secteur) actions = actions.filter((a) => a.secteur === secteur);
  if (pays) actions = actions.filter((a) => a.pays === pays);

  if (classement === 'A') {
    actions = actions.filter((a) => a.classement_a_rang != null).sort((a, b) => a.classement_a_rang! - b.classement_a_rang!);
  } else if (classement === 'C') {
    actions = actions.filter((a) => a.classement_c_rang != null).sort((a, b) => a.classement_c_rang! - b.classement_c_rang!);
  } else if (classement === 'decrochages') {
    actions = actions.filter((a) => a.decrochage_anormal).sort((a, b) => (a.decrochage_relatif_pct ?? 0) - (b.decrochage_relatif_pct ?? 0));
  }

  if (format === 'csv') {
    const header = [
      'code', 'designation', 'secteur', 'pays', 'famille_comptable', 'exercice_comptes', 'cours_jour',
      'perf_1j_pct', 'perf_1m_pct', 'perf_3m_pct', 'perf_ytd_pct', 'perf_1a_pct', 'perf_totale_1a_pct',
      'drawdown_pct', 'volatilite_ann_pct', 'beta', 'decrochage_relatif_pct', 'decrochage_anormal',
      'per', 'pbr', 'roe_pct', 'rendement_div_pct', 'score_liquidite', 'peu_liquide', 'rang_resistance', 'rang_baisse',
    ].join(';');

    const lines = actions.map((a) =>
      [
        a.code, a.designation, a.secteur, a.pays, a.famille_comptable, a.fondamentaux.exercice, a.cours_jour,
        a.perf_1j_pct, a.perf_1m_pct, a.perf_3m_pct, a.perf_ytd_pct, a.perf_1a_pct, a.perf_totale_1a_pct,
        a.drawdown_pct, a.volatilite_ann_pct, a.beta, a.decrochage_relatif_pct, a.decrochage_anormal,
        a.fondamentaux.per, a.fondamentaux.pbr, a.fondamentaux.roe_pct, a.dividendes.rendement_pct,
        a.liquidite.score_v2, a.illiquide_flag, a.classement_a_rang, a.classement_c_rang,
      ]
        .map(csvEscape)
        .join(';'),
    );

    const csv = `\uFEFF${[header, ...lines].join('\n')}`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="westbourse-resilience-scanner.csv"',
        'Cache-Control': 'private, no-store',
      },
    });
  }

  return NextResponse.json(
    {
      ...data,
      count: actions.length,
      actions,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
