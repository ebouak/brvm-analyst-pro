import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createPublicClient } from '@/lib/supabase/public';
import { chargerDonneesCrises } from '@/lib/stress/lecture';

const QuerySchema = z.object({
  indice: z.string().trim().min(2).max(16).optional(),
  seuil: z.coerce.number().min(-50).max(-1).optional(),
  statut: z.enum(['tous', 'en_cours', 'termine']).optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

const csvEscape = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    indice: searchParams.get('indice') ?? undefined,
    seuil: searchParams.get('seuil') ?? undefined,
    statut: searchParams.get('statut') ?? undefined,
    format: searchParams.get('format') ?? 'json',
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres invalides', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { indice, seuil, statut, format } = parsed.data;
  const sb = createPublicClient();
  const data = await chargerDonneesCrises(sb, { indiceCode: indice?.toUpperCase() });

  let episodes = data.episodes;
  if (seuil !== undefined) {
    episodes = episodes.filter((e) => Number(e.seuil_pct) === seuil);
  }
  if (statut && statut !== 'tous') {
    episodes = episodes.filter((e) => e.statut === statut);
  }

  if (format === 'csv') {
    const header = [
      'indice_code',
      'seuil_pct',
      'niveau',
      'libelle',
      'statut',
      'date_sommet',
      'valeur_sommet',
      'date_debut_correction',
      'date_creux',
      'valeur_creux',
      'perte_max_pct',
      'nb_seances_baisse',
      'duree_calendaire_baisse',
      'nb_rebonds_intermediaires',
      'amplitude_max_rebond_pct',
      'date_recuperation',
      'nb_seances_rebond',
      'duree_totale_recuperation_jours',
      'rebond_1m_pct',
      'rebond_3m_pct',
      'rebond_6m_pct',
      'rebond_12m_pct',
      'rebond_24m_pct',
      'similarite_actuelle',
    ].join(';');

    const lines = episodes.map((e) =>
      [
        e.indice_code,
        e.seuil_pct,
        e.niveau,
        e.libelle,
        e.statut,
        e.date_sommet,
        e.valeur_sommet,
        e.date_debut_correction,
        e.date_creux,
        e.valeur_creux,
        e.perte_max_pct,
        e.nb_seances_baisse,
        e.duree_calendaire_baisse,
        e.nb_rebonds_intermediaires,
        e.amplitude_max_rebond_pct,
        e.date_recuperation,
        e.nb_seances_rebond,
        e.duree_totale_recuperation_jours,
        e.rebond_1m_pct,
        e.rebond_3m_pct,
        e.rebond_6m_pct,
        e.rebond_12m_pct,
        e.rebond_24m_pct,
        e.similarite_actuelle,
      ]
        .map(csvEscape)
        .join(';'),
    );

    const csv = `\uFEFF${[header, ...lines].join('\n')}`;
    const fname = `westbourse-crises-${(indice ?? 'tous').toLowerCase()}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fname}"`,
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  }

  return NextResponse.json(
    {
      source_mode: data.source_mode,
      derniere_seance: data.derniere_seance,
      couverture: data.couverture,
      indices_actuels: data.indices_actuels,
      nervosite: data.nervosite,
      count: episodes.length,
      episodes,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    },
  );
}
