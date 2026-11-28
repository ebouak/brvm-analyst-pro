import { NextResponse } from 'next/server';
import { z } from 'zod';
import { canAccess } from '@/lib/server/featureAccess';
import { chargerBacktestStress } from '@/lib/stress/lectureBacktest';

const QuerySchema = z.object({
  indice: z.enum(['BRVMC', 'BRVM30', 'BRVMPRES']).default('BRVMC'),
  frais: z.coerce.number().min(0).max(5).default(1.5),
  clustering: z.coerce.number().int().min(15).max(365).default(90),
  format: z.enum(['json', 'csv']).default('json'),
});

const csvEscape = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(request: Request) {
  const access = await canAccess('stress_backtest');
  if (!access.allowed) {
    return NextResponse.json(
      { error: 'Accès Premium requis pour le Backtesting historique', required: access.required },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    indice: searchParams.get('indice') ?? 'BRVMC',
    frais: searchParams.get('frais') ?? '1.5',
    clustering: searchParams.get('clustering') ?? '90',
    format: searchParams.get('format') ?? 'json',
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres invalides', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { indice, frais, clustering, format } = parsed.data;
  const data = await chargerBacktestStress({
    indiceCode: indice,
    fraisPct: frais,
    clusteringJours: clustering,
  });

  if (format === 'csv') {
    const header = [
      'indice',
      'seuil_pct',
      'horizon_mois',
      'mode',
      'n',
      'statut_statistique',
      'mediane_pct',
      'moyenne_pct',
      'ic95_bas_pct',
      'ic95_haut_pct',
      'p25_pct',
      'p75_pct',
      'proba_positif_pct',
      'perte_sup_moyenne_pct',
      'perte_sup_pire_pct',
      'delai_retour_sommet_median_jours',
    ].join(';');

    const lines: string[] = [];
    for (const s of data.stats_seuils) {
      for (const h of s.horizons) {
        for (const [mode, dist] of [
          ['independant', h.independant],
          ['tous_franchissements', h.tous_franchissements],
        ] as const) {
          lines.push(
            [
              data.indice_code,
              s.seuil_pct,
              h.horizon_mois,
              mode,
              dist.n,
              dist.statut_statistique,
              dist.mediane_pct,
              dist.moyenne_pct,
              dist.ic95_moyenne?.[0] ?? null,
              dist.ic95_moyenne?.[1] ?? null,
              dist.p25_pct,
              dist.p75_pct,
              dist.proba_positif_pct,
              dist.perte_sup_moyenne_pct,
              dist.perte_sup_pire_pct,
              dist.delai_retour_sommet_median_jours,
            ]
              .map(csvEscape)
              .join(';'),
          );
        }
      }
    }

    const csv = `\uFEFF${[header, ...lines].join('\n')}`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="westbourse-stress-backtest-${data.indice_code}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  return NextResponse.json(data, {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
