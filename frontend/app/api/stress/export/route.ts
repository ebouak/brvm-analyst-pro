import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { createPublicClient } from '@/lib/supabase/public';
import { chargerDonneesCrises } from '@/lib/stress/lecture';
import { chargerStressIndexOverview } from '@/lib/stress/lectureStressIndex';

const QuerySchema = z.object({
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
});

const csvEscape = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    format: searchParams.get('format') ?? 'xlsx',
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Format invalide (xlsx ou csv attendu)' }, { status: 400 });
  }

  const sb = createPublicClient();
  const [crisesData, stressData] = await Promise.all([
    chargerDonneesCrises(sb),
    chargerStressIndexOverview(sb, 260),
  ]);

  if (parsed.data.format === 'csv') {
    const header = [
      'date_marche',
      'stress_index_0_100',
      'regime',
      'couverture_composantes_pct',
      'variation_5j_pts',
      'variation_20j_pts',
      'brvmc_cloture',
      'drawdown_brvmc_pct',
      'largeur_hausses_5j_pct',
      'ecart_brvmc_mm20_pct',
      'variation_brvmv_20j_pts',
      'ratio_volume_60j',
    ].join(';');

    const lines = stressData.historique.map((r) =>
      [
        r.date_marche,
        r.stress_index,
        r.regime,
        r.couverture_composantes_pct,
        r.variation_5j_pts,
        r.variation_20j_pts,
        r.observables_marche.brvmc_cloture,
        r.observables_marche.drawdown_brvmc_pct,
        r.observables_marche.largeur_hausses_5j_pct,
        r.observables_marche.ecart_brvmc_mm20_pct,
        r.observables_marche.variation_brvmv_20j_pts,
        r.observables_marche.ratio_volume_60j,
      ]
        .map(csvEscape)
        .join(';'),
    );

    const csv = `\uFEFF${[header, ...lines].join('\n')}`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="westbourse-stress-monitor.csv"',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'WESTBOURSE';
  wb.created = new Date();

  // Feuille 1 : Indice quotidien de stress
  const wsStress = wb.addWorksheet('Indice Stress 0-100');
  wsStress.columns = [
    { header: 'Date séance', key: 'date', width: 14 },
    { header: 'Stress Index (/100)', key: 'stress', width: 18 },
    { header: 'Régime descriptif', key: 'regime', width: 20 },
    { header: 'Couverture (%)', key: 'couv', width: 15 },
    { header: 'Var. 5j (pts)', key: 'v5', width: 14 },
    { header: 'Var. 20j (pts)', key: 'v20', width: 14 },
    { header: 'BRVMC clôture', key: 'brvmc', width: 15 },
    { header: 'Drawdown BRVMC (%)', key: 'dd', width: 18 },
    { header: 'Largeur hausses 5j (%)', key: 'larg', width: 20 },
    { header: 'Écart MM20 (%)', key: 'mm20', width: 16 },
    { header: 'Ratio volume / méd. 60j', key: 'rvol', width: 22 },
  ];
  for (const r of stressData.historique) {
    wsStress.addRow({
      date: r.date_marche,
      stress: r.stress_index,
      regime: r.regime,
      couv: r.couverture_composantes_pct,
      v5: r.variation_5j_pts,
      v20: r.variation_20j_pts,
      brvmc: r.observables_marche.brvmc_cloture,
      dd: r.observables_marche.drawdown_brvmc_pct,
      larg: r.observables_marche.largeur_hausses_5j_pct,
      mm20: r.observables_marche.ecart_brvmc_mm20_pct,
      rvol: r.observables_marche.ratio_volume_60j,
    });
  }

  // Feuille 2 : Crises historiques
  const wsCrises = wb.addWorksheet('Crises historiques');
  wsCrises.columns = [
    { header: 'Indice', key: 'indice', width: 12 },
    { header: 'Seuil (%)', key: 'seuil', width: 11 },
    { header: 'Libellé', key: 'libelle', width: 28 },
    { header: 'Statut', key: 'statut', width: 12 },
    { header: 'Date sommet', key: 'sommet', width: 14 },
    { header: 'Date creux', key: 'creux', width: 14 },
    { header: 'Perte max (%)', key: 'perte', width: 15 },
    { header: 'Séances baisse', key: 'nb_baisse', width: 15 },
    { header: 'Date récupération', key: 'recup', width: 16 },
    { header: 'Rebond +12M (%)', key: 'r12', width: 16 },
    { header: 'Similarité actuelle (/100)', key: 'sim', width: 22 },
  ];
  for (const ep of crisesData.episodes) {
    wsCrises.addRow({
      indice: ep.indice_code,
      seuil: ep.seuil_pct,
      libelle: ep.libelle,
      statut: ep.statut,
      sommet: ep.date_sommet,
      creux: ep.date_creux,
      perte: ep.perte_max_pct,
      nb_baisse: ep.nb_seances_baisse,
      recup: ep.date_recuperation,
      r12: ep.rebond_12m_pct,
      sim: ep.similarite_actuelle ?? null,
    });
  }

  // Feuille 3 : Notice méthodologique
  const wsNote = wb.addWorksheet('Notice méthodologique');
  wsNote.columns = [
    { header: 'Rubrique', key: 'rubrique', width: 30 },
    { header: 'Précision', key: 'detail', width: 95 },
  ];
  wsNote.addRows([
    {
      rubrique: 'Nature de l’outil',
      detail: 'Thermomètre descriptif contemporain de la tension du marché BRVM. Aucun conseil d’achat ou de vente.',
    },
    {
      rubrique: 'Pondérations Stress Index',
      detail: 'Drawdown BRVMC (25 %), Largeur baissière 5j (20 %), Volatilité BRVM-V (15 %), Diffusion sectorielle 20j (15 %), Volumes baissiers 5j (15 %), Momentum 20j (10 %). Renormalisation automatique si composante absente.',
    },
    {
      rubrique: 'Sources',
      detail: 'BRVM officiel (brvm_indices_daily, brvm_actions_daily), Sikafinance (historique pré-mai 2026 dans stress_indices_history), BCEAO (CPM : taux minimum de soumission séparé du prêt marginal), Banque Mondiale.',
    },
  ]);

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="westbourse-stress-monitor.xlsx"',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
