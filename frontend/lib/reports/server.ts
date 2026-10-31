import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { FAMILLE_PAR_CODE } from '@/lib/financials/sectors';
import { classifyCompany, type ProfilInfo } from './profile';

export interface YearRow {
  periode: string;
  revenu: number | null;
  resultatExploitation: number | null;
  resultatNet: number | null;
  bpa: number | null;
  capitauxPropres: number | null;
  totalActif: number | null;
}
export interface RevueData {
  code: string;
  designation: string;
  secteur: string;
  pays: string;
  profil: ProfilInfo;
  years: YearRow[]; // ordre décroissant (le plus récent d'abord)
  latest: YearRow | null;
  prev: YearRow | null;
  price: { date: string; cours: number | null; mcap: number | null; beta: number | null } | null;
  priceSeries: { date: string; cours: number }[];
  dividends: { exercice: number; montant: number }[];
  ratios: { per: number | null; yieldPct: number | null; margeNette: number | null; payout: number | null };
  highlights: {
    synthese: string | null;
    items: { titre: string; detail: string }[];
    source_libelle: string | null;
    source_url: string | null;
    exercice: number | null;
  } | null;
  generatedAt: string;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export async function getRevue(code: string): Promise<RevueData | null> {
  const sb = createClient();
  const C = code.toUpperCase();

  type LigneCours = { date_marche: string; cours_jour: unknown; valorisation: unknown; beta_1an: unknown };
  const [instrR, incomeR, balanceR, priceRows, divR, hlR] = await Promise.all([
    sb.from('brvm_instruments').select('designation, secteur, pays').eq('code', C).maybeSingle(),
    sb.from('income_statements').select('periode, revenu_total, resultat_exploitation, resultat_net, benefice_par_action')
      .eq('code', C).eq('type_periode', 'annuel').order('periode', { ascending: false }).limit(6),
    sb.from('balance_sheets').select('periode, total_actifs, total_capitaux_propres')
      .eq('code', C).eq('type_periode', 'annuel').order('periode', { ascending: false }).limit(6),
    // Paginé : PostgREST s'arrête à 1000 lignes en silence. Lu par ordre
    // croissant, l'historique s'arrêtait donc en 2018, et la revue prenait la
    // clôture de 2018 pour le « cours » (UNLC : 8 200 FCFA au 2018-05-18,
    // P/E de 117x) alors que la base va jusqu'à la dernière séance.
    fetchAllRows<LigneCours>((from, to) =>
      sb.from('brvm_actions_daily').select('date_marche, cours_jour, valorisation, beta_1an')
        .eq('code', C).order('date_marche', { ascending: true }).range(from, to)),
    sb.from('dividends').select('exercice, montant').eq('code', C).order('exercice', { ascending: true }),
    sb.from('rapport_highlights').select('synthese, highlights, source_libelle, source_url').eq('code', C).maybeSingle(),
  ]);

  const instr = instrR.data as { designation?: string; secteur?: string; pays?: string } | null;
  if (!instr && (!incomeR.data || incomeR.data.length === 0)) return null;

  const secteur = instr?.secteur ?? '';
  const profil = classifyCompany(C, secteur, FAMILLE_PAR_CODE[C]);

  // Bilan indexé par période pour la jointure.
  const balByPer = new Map<string, { total_actifs: unknown; total_capitaux_propres: unknown }>();
  for (const b of (balanceR.data ?? []) as Array<{ periode: string; total_actifs: unknown; total_capitaux_propres: unknown }>) {
    balByPer.set(b.periode, b);
  }
  const allYears: YearRow[] = ((incomeR.data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const bal = balByPer.get(r.periode as string);
    return {
      periode: r.periode as string,
      revenu: num(r.revenu_total),
      resultatExploitation: num(r.resultat_exploitation),
      resultatNet: num(r.resultat_net),
      bpa: num(r.benefice_par_action),
      capitauxPropres: bal ? num(bal.total_capitaux_propres) : null,
      totalActif: bal ? num(bal.total_actifs) : null,
    };
  });
  const years = allYears.slice(0, profil.anneesAffichees);
  const latest = allYears[0] ?? null;
  const prev = allYears[1] ?? null;

  // Cours : dernier point + série (échantillonnée pour le graphique).
  const rawSeries = priceRows.filter((p) => num(p.cours_jour) != null);
  const lastPx = rawSeries.length ? rawSeries[rawSeries.length - 1] : null;
  const lastFull = priceRows.slice(-1)[0];
  // ~150 points max
  const step = Math.max(1, Math.floor(rawSeries.length / 150));
  const priceSeries = rawSeries.filter((_, i) => i % step === 0 || i === rawSeries.length - 1)
    .map((p) => ({ date: p.date_marche, cours: num(p.cours_jour) as number }));

  const price = lastPx
    ? {
        date: lastPx.date_marche,
        cours: num(lastPx.cours_jour),
        mcap: lastFull ? num(lastFull.valorisation) : null,
        beta: lastFull ? num(lastFull.beta_1an) : null,
      }
    : null;

  const dividends = ((divR.data ?? []) as Array<{ exercice: unknown; montant: unknown }>)
    .map((d) => ({ exercice: Number(d.exercice), montant: num(d.montant) ?? 0 }))
    .filter((d) => Number.isFinite(d.exercice) && d.montant > 0);

  // Ratios (sur le dernier exercice + dernier cours).
  const cours = price?.cours ?? null;
  const lastDiv = dividends.length ? dividends[dividends.length - 1].montant : null;
  const per = cours != null && latest?.bpa ? cours / latest.bpa : null;
  const yieldPct = cours != null && lastDiv ? (lastDiv / cours) * 100 : null;
  const margeNette = latest?.revenu && latest?.resultatNet != null ? (latest.resultatNet / latest.revenu) * 100 : null;
  const payout = latest?.bpa && lastDiv ? (lastDiv / latest.bpa) * 100 : null;

  const hl = hlR.data as
    | { synthese?: string; highlights?: unknown; source_libelle?: string; source_url?: string }
    | null;
  const highlights = hl
    ? {
        synthese: hl.synthese ?? null,
        items: Array.isArray(hl.highlights)
          ? (hl.highlights as Array<{ titre?: string; detail?: string }>)
              .filter((i) => i && (i.titre || i.detail))
              .map((i) => ({ titre: i.titre ?? '', detail: i.detail ?? '' }))
          : [],
        source_libelle: hl.source_libelle ?? null,
        source_url: hl.source_url ?? null,
        // « Rapport d'activités annuel exercice 2021 » → 2021. Sert à dire
        // quand ce texte est antérieur aux comptes affichés au-dessus.
        exercice: Number(hl.source_libelle?.match(/exercice\s+(\d{4})/i)?.[1]) || null,
      }
    : null;

  return {
    code: C,
    designation: instr?.designation ?? C,
    secteur,
    pays: instr?.pays ?? '',
    profil,
    years,
    latest,
    prev,
    price,
    priceSeries,
    dividends,
    ratios: { per, yieldPct, margeNette, payout },
    highlights,
    generatedAt: new Date().toISOString(),
  };
}
