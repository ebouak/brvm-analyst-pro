import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { getLastMarketDate } from '@/lib/marketDate';
import { TasteTopbar } from '@/components/landing/taste/TasteTopbar';
import RatingBadge from '@/components/RatingBadge';
import NewsletterForm from '@/components/NewsletterForm';
import { IndicesCompactCard } from '@/components/landing/IndicesCompactCard';
import LandingHeatmap from '@/components/landing/LandingHeatmap';
import { loadHeatmap } from '@/lib/heatmapData';
import type { HeatmapNode } from '@/lib/heatmap';
import { simulateInvestment, type PricePoint } from '@/lib/simulate';
import { fmtNumber } from '@/lib/format';
import type { TickItem } from '@/components/landing/taste/types';
import type { RealtimeActionRow } from '@/lib/realtime/mergeActions';
import type { IndiceDaily, SignalDaily } from '@/lib/types';
import { getSgiDirectory } from '@/lib/sgi-frais/queries';
import { PAYS as SGI_PAYS } from '@/lib/sgi-frais/directory';
import { HeroDeviceMockup } from '@/components/landing/HeroDeviceMockup';
import { ProofBand } from '@/components/landing/ProofBand';
import { AppPreview } from '@/components/landing/AppPreview';
import { LandingFaq } from '@/components/landing/LandingFaq';
import { MoverSparkline } from '@/components/landing/MoverSparkline';
import { RatingSpotlight } from '@/components/landing/RatingSpotlight';
import { PremiumCompare } from '@/components/landing/PremiumCompare';
import { excerpt } from '@/lib/landing/excerpt';
import { getMemberCount } from '@/lib/landing/memberCount';
import { getLatestDiagnostic } from '@/lib/landing/latestDiagnostic';
import { getVideoSeance } from '@/lib/landing/videoSeance';
import { computeSectorVariations, type SectorVariation } from '@/lib/landing/sectors';
import { computeRatios, latestUsable, type FundamentalsRow } from '@/lib/landing/fundamentals';
import { SectorStrip } from '@/components/landing/SectorStrip';
import { DataToDecision } from '@/components/landing/DataToDecision';
import { PlatformUniverses } from '@/components/landing/PlatformUniverses';
import { VideoSeance } from '@/components/landing/VideoSeance';
import { DarkBand } from '@/components/landing/DarkBand';
import MarketStateCard, { type MarketStats, type Breakdown } from '@/components/MarketStateCard';
import { StockSpotlight, type StockDetail } from '@/components/landing/StockSpotlight';
import { FundamentalsPreview, type FundamentalsPreviewData } from '@/components/landing/FundamentalsPreview';
import brvmSectors from '@/lib/brvmSectors.json';

// ISR : la landing n'affiche que des données publiques (marché). On la met en
// cache CDN et on la revalide toutes les 5 min (les cours bougent ~15 min) →
// HTML servi instantanément, gros gain LCP/Speed Index sur mobile.
export const revalidate = 300;
export const metadata = {
  title: 'WESTBOURSE — Décidez sur la BRVM avec des données, pas des rumeurs',
  description:
    'Cours BRVM toutes les 15 min, note A–F par action, fondamentaux vérifiés, simulateur et brief quotidien. Gratuit — créez votre compte en 1 minute.',
};

const nf = (n: number, d = 0) => n.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });

/** Une ligne de `brvm_actions_daily` telle que la landing la charge. */
interface SeanceRow {
  code: string;
  cours_jour: number | null;
  variation_pct: number | null;
  volume: number | null;
  ouverture: number | null;
  plus_haut: number | null;
  plus_bas: number | null;
  cours_precedent: number | null;
  valeur_echangee: number | null;
  nb_transactions: number | null;
  beta_1an: number | null;
  valorisation: number | null;
}

interface MoverRow {
  code: string;
  /** Raison sociale (brvm_instruments.designation) — null si le référentiel ne la porte pas. */
  nom: string | null;
  cours: number | null;
  pct: number;
  score: number | null;
  confiance: number | null;
  /** Clôtures réelles des dernières séances, pour la mini-courbe. Vide = pas de courbe. */
  spark: number[];
}

interface NewsCardItem {
  id: string;
  titre: string;
  date_publication: string | null;
  source_url: string | null;
  instrument_code: string | null;
}

async function getData() {
  const supabase = createPublicClient();

  // Étape 1 : toutes les requêtes qui ne dépendent d'aucune valeur calculée
  // par une autre requête partent en un seul aller-retour réseau. (Avant :
  // enchaînées en `await` séquentiels — chacune attendait la précédente sans
  // raison, l'ancienne date brièvement postulée n'étant en réalité utile qu'à
  // deux fetches précis, traités à l'étape 2 ci-dessous.)
  // Extraite dans lib/marketDate.ts (voir ce fichier pour le détail du partage).
  const lastDayPromise = getLastMarketDate(supabase);
  // Indices BRVM (11) — date propre, pas toujours alignée sur les cours actions.
  const lastIdxPromise = supabase
    .from('brvm_indices_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  // Brief du jour (extrait)
  const briefPromise = supabase
    .from('brief_daily')
    .select('date_marche, contenu')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  // Simulation réelle : 1 000 000 FCFA dans SNTS il y a 5 ans — ne dépend que
  // d'une date calculée localement, aucune valeur d'une autre requête.
  const simulationPromise: Promise<{ finalValue: number; pct: number; years: number } | null> = (async () => {
    try {
      const from = new Date();
      from.setFullYear(from.getFullYear() - 5);
      const fromIso = from.toISOString().split('T')[0]!;
      const [{ data: snts }, { data: divs }] = await Promise.all([
        supabase
          .from('brvm_actions_daily')
          .select('date_marche, cours_jour')
          .eq('code', 'SNTS')
          .gte('date_marche', fromIso)
          .order('date_marche', { ascending: true }),
        supabase.from('dividends').select('montant, payment_date, ex_date').eq('code', 'SNTS'),
      ]);
      const prices: PricePoint[] = (snts ?? [])
        .filter((r) => r.cours_jour != null && r.cours_jour > 0)
        .map((r) => ({ date: r.date_marche as string, close: r.cours_jour as number }));
      const dividends = (divs ?? [])
        .map((d) => ({ date: (d.payment_date ?? d.ex_date ?? '') as string, montant: d.montant as number }))
        .filter((d) => d.date);
      const sim = simulateInvestment(1_000_000, fromIso, prices, dividends);
      return sim ? { finalValue: sim.finalValue, pct: sim.totalReturnPct, years: sim.years } : null;
    } catch {
      return null; /* pas de simulation si données indisponibles */
    }
  })();
  // Actualités du marché (4 dernières) pour la section cartes
  const newsPromise = supabase
    .from('brvm_news')
    .select('id, titre, date_publication, source_url, instrument_code')
    .lte('date_publication', new Date().toISOString().slice(0, 10)) // jamais d'actu datée dans le futur
    .order('date_publication', { ascending: false })
    .limit(4);
  // Cartographie du marché (treemap landing) — même chargement que /heatmap.
  // loadHeatmap() résout elle-même sa propre "dernière date" en interne,
  // aucune dépendance sur `asOf`/`idxDate` calculés dans cette fonction.
  const heatmapPromise: Promise<HeatmapNode[]> = (async () => {
    try {
      const { rows } = await loadHeatmap(supabase);
      return rows;
    } catch {
      return []; /* pas de cartographie si données indisponibles */
    }
  })();
  // `diagnostic_reports` est sous RLS : la clé anon n'y voit aucune ligne, la
  // section affichait donc son état vide pour tout visiteur public. Lecture
  // service-role bordée à 3 colonnes non personnelles — voir le module.
  const diagReportPromise = getLatestDiagnostic().then((data) => ({ data }));
  const planRowsPromise = supabase
    .from('subscription_plans')
    .select('id, code, name, price_monthly, is_recommended, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  // Annuaire SGI (comparateur) : lecture publique pure, aucun cookie ni
  // donnée de session (voir frontend/lib/sgi-frais/queries.ts) — rejoint le
  // même cache 5 min que le reste de la landing au lieu d'un appel à part et
  // non caché dans Landing().
  const sgiDirectoryPromise = getSgiDirectory();
  // Référentiel des sociétés : 48 lignes, sert à afficher la raison sociale sous
  // le code dans les movers. Ne dépend d'aucune valeur calculée → lot 1.
  const instrumentsPromise = supabase.from('brvm_instruments').select('code, designation, shares');
  // Nombre réel de comptes : lecture service-role (profiles est sous RLS owner,
  // la clé anon y voit 0). Ne lève jamais — voir lib/landing/memberCount.ts.
  const memberCountPromise = getMemberCount();
  // Fiche de la derniere video de seance (objet de stockage public). Ne leve
  // jamais : renvoie null tant que le worker video/ n'a pas publie.
  const videoSeancePromise = getVideoSeance();
  // Série récente du BRVM-C : alimente le graphe du terminal du hero.
  // Aucune donnée intraday n'existe (la BRVM n'en publie pas) — ce sont donc
  // les clôtures des dernières séances, jamais une courbe simulée.
  const brvmcSeriePromise = supabase
    .from('brvm_indices_daily')
    .select('valeur, date_marche')
    .eq('code', 'BRVMC')
    .order('date_marche', { ascending: false })
    .limit(40);
  // Nombre de lignes obligataires réellement cotées à la dernière séance
  // obligataire (qui n'est pas forcément celle des actions). Deux allers-retours
  // enchaînés, mais l'ensemble part en parallèle du reste du lot 1.
  const nbObligationsPromise: Promise<number | null> = (async () => {
    try {
      const { data: last } = await supabase
        .from('brvm_obligations_daily')
        .select('date_marche')
        .order('date_marche', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!last?.date_marche) return null;
      const { count } = await supabase
        .from('brvm_obligations_daily')
        .select('code', { count: 'exact', head: true })
        .eq('date_marche', last.date_marche as string);
      return typeof count === 'number' ? count : null;
    } catch {
      return null;
    }
  })();

  // Sûr sans .throwOnError() nulle part dans ce fichier : le client Supabase
  // résout toujours { data, error } sans jamais rejeter la Promise, même en
  // cas d'erreur réseau/RLS — un Promise.all ici ne peut donc pas transformer
  // une section en panne en page cassée. Ne PAS ajouter .throwOnError() à
  // l'une de ces requêtes sans réévaluer cette garantie.
  //
  // ⚠️ Les deux listes ci-dessous doivent rester dans le MÊME ORDRE (client
  // public non généré par `Database`, donc aucun filet de type ne détecterait
  // un décalage positionnel) — tout ajout doit toucher les deux en même position.
  const [
    asOf,
    { data: lastIdx },
    { data: brief },
    simulation,
    { data: newsRows },
    heatmapRows,
    { data: diagReport },
    { data: planRows },
    sgiDirectory,
    { data: instrumentRows },
    memberCount,
    nbObligations,
    { data: brvmcRows },
    videoSeance,
  ] = await Promise.all([
    lastDayPromise,
    lastIdxPromise,
    briefPromise,
    simulationPromise,
    newsPromise,
    heatmapPromise,
    diagReportPromise,
    planRowsPromise,
    sgiDirectoryPromise,
    instrumentsPromise,
    memberCountPromise,
    nbObligationsPromise,
    brvmcSeriePromise,
    videoSeancePromise,
  ]);

  const idxDate = (lastIdx?.date_marche as string | undefined) ?? null;
  const news = (newsRows ?? []) as NewsCardItem[];
  const planIds = (planRows ?? []).map((p) => p.id as string);

  let ticks: TickItem[] = [];
  let tickerRows: RealtimeActionRow[] = [];
  let hausses: MoverRow[] = [];
  let baisses: MoverRow[] = [];
  let flatTop: MoverRow[] = [];
  let nbActions = 0;
  let volumeTotal = 0;
  let spotlightSignal: (SignalDaily & { code: string }) | null = null;
  let indices: IndiceDaily[] = [];
  let sectors: SectorVariation[] = [];
  const brvmcSerie = ((brvmcRows ?? []) as { valeur: number | null }[])
    .map((r) => r.valeur)
    .filter((v): v is number => v != null && v > 0)
    .reverse();
  /** Trois meilleures notes de la séance, pour les cartes du terminal. */
  let topRated: { code: string; score: number | null; confiance: number | null }[] = [];
  /** Compteurs de séance pour le terminal du hero : totaux du marché, pas des tops. */
  let nbHausses = 0;
  let nbBaisses = 0;
  let nbTransactions = 0;
  /** État du marché — composant partagé avec le dashboard. */
  let marketStats: MarketStats | null = null;
  let breakdown: Breakdown | undefined;
  let sentimentScore = 50;
  /** Écart de sentiment contre la veille, en points. null si la séance
      précédente n'est pas exploitable — jamais 0, qui se lirait « stable ». */
  let sentimentDelta: number | null = null;
  let featured: StockDetail | null = null;
  let fundamentals: FundamentalsPreviewData | null = null;

  // Étape 2 : les requêtes qui dépendent d'une valeur connue seulement après
  // l'étape 1 (idxDate, asOf, planIds) — mais qui ne dépendent PAS les unes
  // des autres — partent elles aussi en parallèle plutôt qu'en 3 allers-retours
  // successifs.
  const idxRowsPromise = idxDate
    ? supabase.from('brvm_indices_daily').select('*').eq('date_marche', idxDate)
    : Promise.resolve({ data: null as IndiceDaily[] | null });
  const asOfBlockPromise = asOf
    ? Promise.all([
        supabase
          .from('brvm_actions_daily')
          .select(
            'code, cours_jour, variation_pct, volume, ouverture, plus_haut, plus_bas, cours_precedent, valeur_echangee, nb_transactions, beta_1an, valorisation',
          )
          .eq('date_marche', asOf)
          .order('variation_pct', { ascending: false }),
        supabase.from('signals_daily').select('code, score_total, confiance, signal').eq('date_marche', asOf),
        // Signal spotlight : ne dépend que d'asOf, aucune donnée calculée
        // ci-dessous — rejoint ce Promise.all plutôt qu'un aller-retour à part.
        supabase
          .from('signals_daily')
          .select('*')
          .eq('date_marche', asOf)
          .order('score_total', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
    : Promise.resolve(null);
  const featureRowsPromise = planIds.length
    ? supabase
        .from('plan_features')
        .select('id, plan_id, feature_label, feature_value, sort_order')
        .in('plan_id', planIds)
        .order('sort_order', { ascending: true })
    : Promise.resolve({ data: [] as { id: string; plan_id: string; feature_label: string; feature_value: string | null }[] });

  const [idxRowsRes, asOfBlockRes, featureRowsRes] = await Promise.all([
    idxRowsPromise,
    asOfBlockPromise,
    featureRowsPromise,
  ]);

  indices = (idxRowsRes.data ?? []) as IndiceDaily[];

  if (asOfBlockRes) {
    const [{ data: rows }, { data: sigs }, { data: topSignal }] = asOfBlockRes;
    spotlightSignal = (topSignal as (SignalDaily & { code: string })) ?? null;
    const all = (rows ?? []) as SeanceRow[];
    nbActions = all.length;
    volumeTotal = all.reduce((s, r) => s + (r.volume ?? 0), 0);
    nbTransactions = all.reduce((s, r) => s + (r.nb_transactions ?? 0), 0);
    nbHausses = all.filter((r) => (r.variation_pct ?? 0) > 0).length;
    nbBaisses = all.filter((r) => (r.variation_pct ?? 0) < 0).length;
    const nbStables = all.filter((r) => r.variation_pct === 0).length;

    marketStats = {
      hausses: nbHausses,
      baisses: nbBaisses,
      stables: nbStables,
      total: all.length,
      // `volumeTotal` agrège les volumes par instrument : somme réelle, pas
      // une estimation — d'où volumeEstimated à false.
      volumeTotal: volumeTotal > 0 ? volumeTotal : null,
      volumeEstimated: false,
      volumePrev: null,
      titresEchanges: volumeTotal > 0 ? volumeTotal : null,
      transactions: nbTransactions > 0 ? nbTransactions : null,
    };

    // Sentiment 0..100 dérivé du breadth, MÊME formule que le dashboard
    // (app/dashboard/page.tsx) — ne pas en inventer une seconde ici.
    sentimentScore = nbHausses + nbBaisses > 0 ? (nbHausses / (nbHausses + nbBaisses)) * 100 : 50;

    // Écart contre la veille : même méthode que le dashboard
    // (app/dashboard/page.tsx, prevBreadth). Un aller-retour de plus, borné à
    // la seule colonne variation_pct de la séance précédente.
    try {
      const { data: prevDateRow } = await supabase
        .from('brvm_actions_daily')
        .select('date_marche')
        .lt('date_marche', asOf as string)
        .order('date_marche', { ascending: false })
        .limit(1)
        .maybeSingle();
      const prevDate = prevDateRow?.date_marche as string | undefined;
      if (prevDate) {
        const { data: prevRows } = await supabase
          .from('brvm_actions_daily')
          .select('variation_pct')
          .eq('date_marche', prevDate);
        let h = 0;
        let b = 0;
        for (const r of (prevRows ?? []) as { variation_pct: number | null }[]) {
          const v = r.variation_pct ?? 0;
          if (v > 0) h++;
          else if (v < 0) b++;
        }
        if (h + b > 0) sentimentDelta = sentimentScore - (h / (h + b)) * 100;
      }
    } catch {
      /* la jauge s'affiche sans écart plutôt que de faire tomber la page */
    }

    const toMover = (r: SeanceRow) => ({ code: r.code, cours: r.cours_jour, variation: r.variation_pct ?? 0 });
    breakdown = {
      hausses: all.filter((r) => (r.variation_pct ?? 0) > 0).sort((a, b) => (b.variation_pct ?? 0) - (a.variation_pct ?? 0)).map(toMover),
      baisses: all.filter((r) => (r.variation_pct ?? 0) < 0).sort((a, b) => (a.variation_pct ?? 0) - (b.variation_pct ?? 0)).map(toMover),
      stables: all.filter((r) => r.variation_pct === 0).map(toMover),
    };
    const sigByCode = new Map((sigs ?? []).map((s) => [s.code as string, s]));
    topRated = [...((sigs ?? []) as { code: string; score_total: number | null; confiance: number | null }[])]
      .filter((x) => x.score_total != null)
      .sort((a, b) => (b.score_total ?? 0) - (a.score_total ?? 0))
      .slice(0, 3)
      .map((x) => ({ code: x.code, score: x.score_total, confiance: x.confiance }));
    const withVar = all.filter((r) => r.variation_pct != null);
    const referentiel = (instrumentRows ?? []) as { code: string; designation: string | null; shares: number | null }[];
    const nomByCode = new Map(referentiel.map((i) => [i.code, i.designation]));
    const sharesByCode = new Map(referentiel.map((i) => [i.code, i.shares]));
    const toRow = (r: (typeof all)[number]): MoverRow => ({
      code: r.code,
      nom: nomByCode.get(r.code) ?? null,
      cours: r.cours_jour,
      pct: r.variation_pct ?? 0,
      score: (sigByCode.get(r.code)?.score_total as number | undefined) ?? null,
      confiance: (sigByCode.get(r.code)?.confiance as number | undefined) ?? null,
      spark: [],
    });
    hausses = withVar.filter((r) => (r.variation_pct ?? 0) > 0).slice(0, 5).map(toRow);
    baisses = withVar.filter((r) => (r.variation_pct ?? 0) < 0).slice(-5).reverse().map(toRow);
    // Repli « séance peu animée » : la BRVM est peu liquide, beaucoup de titres
    // ne s'échangent pas → variation 0 % fréquente et légitime. Sans mover signé,
    // on montre quand même la séance via les plus gros volumes (jamais vide alors
    // que des données existent).
    if (hausses.length === 0 && baisses.length === 0) {
      flatTop = [...all]
        .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
        .slice(0, 6)
        .map(toRow);
    }
    // Mini-courbes : un aller-retour de plus, mais borné aux seuls codes
    // réellement affichés (≤ 12) plutôt qu'à tout le marché — ~240 lignes, loin
    // du plafond PostgREST de 1000. Il ne peut pas partir dans le lot 2 : les
    // codes ne sont connus qu'après le calcul des movers ci-dessus.
    const shown = [...hausses, ...baisses, ...flatTop];
    if (shown.length > 0) {
      const since = new Date(asOf as string);
      since.setDate(since.getDate() - 40); // ~20 séances ouvrées
      const { data: hist } = await supabase
        .from('brvm_actions_daily')
        .select('code, date_marche, cours_jour')
        .in('code', shown.map((m) => m.code))
        .gte('date_marche', since.toISOString().slice(0, 10))
        .lte('date_marche', asOf as string)
        .order('date_marche', { ascending: true });
      const seriesByCode = new Map<string, number[]>();
      for (const r of (hist ?? []) as { code: string; cours_jour: number | null }[]) {
        if (r.cours_jour == null || r.cours_jour <= 0) continue;
        const arr = seriesByCode.get(r.code);
        if (arr) arr.push(r.cours_jour);
        else seriesByCode.set(r.code, [r.cours_jour]);
      }
      for (const m of shown) m.spark = seriesByCode.get(m.code) ?? [];
    }

    // Secteurs : agrégation des lignes DÉJÀ chargées ci-dessus, aucune requête
    // supplémentaire. La classification vient de brvmSectors.json car
    // brvm_instruments.secteur est vide en base.
    sectors = computeSectorVariations(
      all.map((r) => ({
        code: r.code,
        variation_pct: r.variation_pct,
        cours_jour: r.cours_jour,
        shares: sharesByCode.get(r.code) ?? null,
      })),
      brvmSectors as Record<string, string>,
    );

    // Valeur mise en avant (section « Comprendre une action ») : la plus
    // échangée de la séance. C'est le choix qui garantit des données de séance
    // réellement remplies — ouverture/plus haut/plus bas restent nuls sur un
    // titre qui ne s'est pas traité.
    const candidat = [...all]
      .filter((r) => r.cours_jour != null && (r.valeur_echangee ?? 0) > 0)
      .sort((a, b) => (b.valeur_echangee ?? 0) - (a.valeur_echangee ?? 0))[0];

    if (candidat) {
      const sig = sigByCode.get(candidat.code) as
        | { score_total?: number; confiance?: number; signal?: string }
        | undefined;
      const il_y_a_un_an = new Date(asOf as string);
      il_y_a_un_an.setFullYear(il_y_a_un_an.getFullYear() - 1);

      const [{ data: hist2 }, { data: divRows }, { data: fundaRows }] = await Promise.all([
        supabase
          .from('brvm_actions_daily')
          .select('cours_jour')
          .eq('code', candidat.code)
          .lte('date_marche', asOf as string)
          .order('date_marche', { ascending: false })
          .limit(60),
        supabase.from('dividends').select('montant, ex_date, payment_date').eq('code', candidat.code),
        supabase
          .from('fundamentals')
          .select('code, year, revenue, net_income, equity, debt')
          .eq('code', candidat.code)
          .order('year', { ascending: false })
          .limit(5),
      ]);

      const serie = ((hist2 ?? []) as { cours_jour: number | null }[])
        .map((r) => r.cours_jour)
        .filter((c): c is number => c != null && c > 0)
        .reverse();

      // Rendement du dividende : somme des montants détachés sur 12 mois
      // glissants, rapportée au cours. null si aucun dividende sur la période
      // — surtout pas 0 %, qui se lirait comme « ne verse rien » alors que la
      // donnée peut simplement manquer.
      const seuil = il_y_a_un_an.toISOString().slice(0, 10);
      const totalDiv = ((divRows ?? []) as { montant: number | null; ex_date: string | null; payment_date: string | null }[])
        .filter((d) => {
          const dt = d.payment_date ?? d.ex_date;
          return dt != null && dt >= seuil && dt <= (asOf as string);
        })
        .reduce((sum, d) => sum + (d.montant ?? 0), 0);

      featured = {
        code: candidat.code,
        nom: nomByCode.get(candidat.code) ?? null,
        cours: candidat.cours_jour,
        variation_pct: candidat.variation_pct,
        ouverture: candidat.ouverture,
        plus_haut: candidat.plus_haut,
        plus_bas: candidat.plus_bas,
        cours_precedent: candidat.cours_precedent,
        volume: candidat.volume,
        valeur_echangee: candidat.valeur_echangee,
        nb_transactions: candidat.nb_transactions,
        beta_1an: candidat.beta_1an,
        valorisation: candidat.valorisation,
        titres: sharesByCode.get(candidat.code) ?? null,
        rendementDividendePct:
          totalDiv > 0 && candidat.cours_jour != null && candidat.cours_jour > 0
            ? (totalDiv / candidat.cours_jour) * 100
            : null,
        score: sig?.score_total ?? null,
        confiance: sig?.confiance ?? null,
        signal: sig?.signal ?? null,
        serie,
      };

      const exercices = (fundaRows ?? []) as FundamentalsRow[];
      const exercice = latestUsable(exercices);
      if (exercice) {
        fundamentals = {
          code: exercice.code,
          nom: nomByCode.get(exercice.code) ?? null,
          year: exercice.year,
          revenue: exercice.revenue,
          net_income: exercice.net_income,
          equity: exercice.equity,
          debt: exercice.debt,
          ratios: computeRatios(exercice),
          // Historique du plus ancien au plus récent, pour les mini-graphiques.
          // On ne garde que les exercices réellement exploitables : une année
          // vide ne doit pas produire une barre à zéro qui se lirait comme
          // « chiffre d'affaires nul ».
          historique: exercices
            .filter((e) => e.revenue != null || e.net_income != null)
            .sort((a, b) => a.year - b.year)
            .map((e) => ({
              year: e.year,
              revenue: e.revenue,
              net_income: e.net_income,
              ratios: computeRatios(e),
            })),
        };
      }
    }

    const tickSource = hausses.length || baisses.length ? [...hausses, ...baisses] : flatTop;
    ticks = tickSource.map((m) => ({
      sym: m.code,
      val: m.cours != null ? nf(m.cours) : '—',
      dir: m.pct >= 0 ? ('up' as const) : ('down' as const),
      pct: `${m.pct >= 0 ? '+' : ''}${m.pct.toFixed(2)}%`,
    }));
    // Lignes brutes des mêmes symboles, pour l'abonnement temps réel du ticker.
    tickerRows = tickSource.map((m) => ({ code: m.code, cours_jour: m.cours, variation_pct: m.pct }));
  }

  const featureRows = featureRowsRes.data;
  const plans = (planRows ?? []).map((p) => ({
    code: p.code as string,
    name: p.name as string,
    // numeric(12,2) revient en chaîne via PostgREST — Number() explicite,
    // même convention que app/pricing/page.tsx et app/account/plan/page.tsx.
    price_monthly: Number(p.price_monthly ?? 0),
    is_recommended: Boolean(p.is_recommended),
    features: (featureRows ?? [])
      .filter((f) => f.plan_id === p.id)
      .map((f) => ({ id: f.id as string, feature_label: f.feature_label as string, feature_value: f.feature_value as string | null })),
  }));

  return {
    asOf,
    ticks,
    tickerRows,
    hausses,
    baisses,
    flatTop,
    nbActions,
    volumeTotal,
    brief,
    simulation,
    indices,
    news,
    heatmapRows,
    spotlightSignal,
    latestDiagnosticReport: diagReport ?? null,
    plans,
    sgiDirectory,
    memberCount,
    sectors,
    brvmcSerie,
    topRated,
    nbHausses,
    nbBaisses,
    nbTransactions,
    marketStats,
    breakdown,
    sentimentScore,
    sentimentDelta,
    featured,
    fundamentals,
    nbObligations,
    videoSeance,
  };
}

// Le layout racine lit la session (cookies) → la route est rendue dynamique et
// l'ISR (`revalidate = 300`) est sans effet sur le HTML. On met donc les
// DONNÉES en cache serveur 5 min : les ~10 requêtes Supabase ci-dessus (dont
// l'annuaire SGI, qui rejoint désormais ce même cache) ne tournent plus à
// chaque visite. Sûr : getData n'utilise que le client public (aucun cookie,
// aucune donnée personnalisée). Depuis l'ajout de getMemberCount(), un appel
// service-role s'y ajoute, mais il ne rapatrie qu'un COMPTE (head: true) :
// aucune ligne de `profiles`, donc rien de personnel ne peut se retrouver en
// cache partagé. Toute lecture service-role ajoutée ici doit rester agrégée.
const getCachedData = unstable_cache(getData, ['landing-data'], { revalidate: 300 });

/* ── Petits composants de section (serveur) ──────────────────────────── */

function MoverLine({ m, rank }: { m: MoverRow; rank: number }) {
  // pct === 0 est neutre, pas "hausse" : évite une puce verte sous un
  // en-tête de carte "Top baisses" en mode repli flatTop (où tous les
  // titres ont un pct exactement nul par construction).
  const sign = m.pct > 0 ? 'up' : m.pct < 0 ? 'down' : 'neutral';
  const tone = sign === 'up' ? 'text-up' : sign === 'down' ? 'text-down' : 'text-muted';
  return (
    <Link
      href={`/societes/${m.code}`}
      className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface/60 px-3 py-2.5 transition-colors hover:border-accent/30 hover:bg-elevated/70"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold tabular ${
          sign === 'up' ? 'border-up/30 text-up' : sign === 'down' ? 'border-down/30 text-down' : 'border-border text-muted'
        }`}
        aria-hidden
      >
        {rank}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-bold text-ivory">{m.code}</span>
          <RatingBadge scoreTotal={m.score} confiance={m.confiance} />
        </span>
        {m.nom && (
          <span className="mt-0.5 block truncate text-[10px] uppercase tracking-wide text-faint">{m.nom}</span>
        )}
      </span>

      {/* Mini-courbe des vraies clôtures ; hérite de la couleur via currentColor. */}
      <span className={`hidden sm:block ${tone}`}>
        <MoverSparkline values={m.spark} />
      </span>

      <span className="shrink-0 text-right">
        <span className="tabular block text-[13px] text-ivory">{m.cours != null ? nf(m.cours) : '—'}</span>
        <span className={`tabular block text-[11px] font-bold ${tone}`}>
          {sign === 'up' ? '+' : ''}{m.pct.toFixed(2)} %
        </span>
      </span>
    </Link>
  );
}

const STEPS = [
  {
    n: '01',
    title: 'Consultez la note A–F',
    body: 'Chaque action notée chaque jour selon des signaux quantitatifs explicables — jamais d’opinion inventée.',
    href: '/societes',
    cta: 'Voir les 48 sociétés',
  },
  {
    n: '02',
    title: 'Vérifiez les fondamentaux',
    body: 'États financiers extraits des publications officielles : CA, résultat net, PER, ROE, dividendes.',
    href: '/societes',
    cta: 'Explorer les fiches',
  },
  {
    n: '03',
    title: 'Entraînez-vous sans risque',
    body: 'Paper trading avec capital fictif, alertes personnalisées et suivi de portefeuille en réel.',
    href: '/signup',
    cta: 'Créer mon compte gratuit',
  },
];

/** Carte compacte des deux rangées à 3 colonnes (densité verticale). */
const ROW_CARD = 'flex flex-col rounded-panel border border-border bg-surface/60 p-5';
const ROW_LINK = 'mt-auto pt-4 text-sm font-medium text-ivory/80 transition-colors hover:text-gold-2';

// Sources de données réellement utilisées (reprises telles quelles de
// components/landing/SocialProof.tsx — aucun logo ni partenaire inventé).
/**
 * Rythme vertical en trois paliers. La page enchaînait des `mt-14` partout,
 * ce qui mettait sur le même plan deux cartes voisines et deux chapitres
 * sans rapport. Un espace doit dire quelque chose : plus il est grand, plus
 * la rupture de sujet est forte.
 */
// Ces respirations sont calibrées pour le desktop, où une page large a besoin
// de vide pour que la hiérarchie se lise. Sur un écran de 390 px le même vide
// devient du défilement pur : le lecteur ne voit qu'une seule chose à la fois,
// et l'espace ne sépare plus rien qu'il puisse comparer. D'où deux valeurs.
const GAP_COMPOSANT = 'mt-5 md:mt-6'; // deux blocs d'une même idée
const GAP_SECTION = 'mt-8 md:mt-12'; // deux idées d'un même chapitre
const GAP_CHAPITRE = 'mt-14 md:mt-24'; // changement de sujet

const PROOF_SOURCES = ['BDFIN', 'BCEAO', 'BloomField', 'GitHub brvm-data-public'];

/**
 * Audience TikTok. Ce chiffre N'EST PAS mesuré par l'application : il est
 * déclaré et doit être relu à la main. Il est distinct du nombre de comptes
 * créés (`memberCount`, lui compté en base) et les deux ne doivent jamais être
 * présentés comme une seule et même « communauté » : le précédent « 2 000+ »
 * codé en dur ici ne correspondait ni à l'un ni à l'autre.
 * Renseigner TIKTOK_URL rend l'affirmation vérifiable d'un clic ; tant qu'elle
 * est nulle, le chiffre s'affiche sans lien.
 */
const TIKTOK_FOLLOWERS = '5 000+';
const TIKTOK_VERIFIE_LE = '2026-08-23';
const TIKTOK_URL: string | null = 'https://www.tiktok.com/@westbourse7';

export default async function Landing() {
  const {
    asOf,
    ticks,
    tickerRows,
    hausses,
    baisses,
    flatTop,
    nbActions,
    volumeTotal,
    brief,
    simulation,
    indices,
    news,
    heatmapRows,
    spotlightSignal,
    latestDiagnosticReport,
    plans,
    sgiDirectory,
    memberCount,
    sectors,
    brvmcSerie,
    topRated,
    nbHausses,
    nbBaisses,
    nbTransactions,
    marketStats,
    breakdown,
    sentimentScore,
    sentimentDelta,
    featured,
    fundamentals,
    nbObligations,
    videoSeance,
  } = await getCachedData();

  // Comptes SGI dynamiques (annuaire Supabase, repli TS) — plus de « 22 » en dur.
  const sgiCount = sgiDirectory.length;
  const sgiPaysCounts = new Map<string, number>();
  for (const s of sgiDirectory) sgiPaysCounts.set(s.pays, (sgiPaysCounts.get(s.pays) ?? 0) + 1);
  const sgiPaysTries = [...sgiPaysCounts.entries()].sort((a, b) => b[1] - a[1]);
  const sgiPaysLines = [
    ...sgiPaysTries.slice(0, 3).map(([c, n]) => `${SGI_PAYS[c]?.nom ?? c} · ${n}`),
    sgiPaysTries.slice(3).map(([c]) => SGI_PAYS[c]?.nom ?? c).join(' · '),
  ].filter(Boolean);
  const dateLabel = asOf
    ? new Date(asOf).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;
  const briefLines = brief
    ? (brief.contenu as string).split('\n').filter((l) => l.trim() && !l.startsWith('Analyse complète')).slice(0, 7)
    : [];
  // Carte « Premium » de la rangée B : plan recommandé si la base en désigne un,
  // sinon le plan payant le plus abordable — jamais un plan écrit en dur.
  const premiumPlan =
    plans.find((p) => p.is_recommended) ??
    [...plans].filter((p) => p.price_monthly > 0).sort((a, b) => a.price_monthly - b.price_monthly)[0] ??
    null;
  const brvmC = indices.find((i) => i.code === 'BRVMC')?.valeur ?? null;
  const brvmCVar = indices.find((i) => i.code === 'BRVMC')?.variation_pct ?? null;
  // Repli "séance peu animée" réparti sur les deux cartes (hausses/baisses)
  // sans dupliquer les mêmes titres — la garde d'affichage porte sur la
  // longueur de CHAQUE moitié, pas sur flatTop.length, pour ne jamais
  // afficher la légende "titres les plus échangés" sans item en dessous
  // (flatTop peut avoir moins de 6 éléments un jour de séance dégradée).
  const flatTopA = flatTop.slice(0, 3);
  const flatTopB = flatTop.slice(3, 6);

  return (
    <div className="relative z-10 mx-auto max-w-content px-4 pb-12">
      <TasteTopbar ticks={ticks} liveRows={tickerRows} dateMarche={asOf} />

      {/* ── HERO : mockup de la vraie interface (BRVM-C, cotations, note) ── */}
      {/* UX : proposition de valeur d'abord ; actualités externes et état de
          séance repoussés SOUS le hero (évite la fuite d'attention above the fold). */}
      {(() => {
        // Même repli que la carte "séance en direct" plus bas : sur une séance
        // calme (fréquent sur la BRVM), hausses/baisses peuvent être vides
        // alors que flatTop porte quand même des titres réels — ne pas priver
        // le hero de son badge de notation dans ce cas.
        const topMoverSource = hausses[0] ?? baisses[0] ?? flatTop[0] ?? null;
        return (
          <HeroDeviceMockup
            dateLabel={dateLabel}
            ticks={ticks}
            brvmC={brvmC}
            brvmCVar={brvmCVar}
            brvmcSerie={brvmcSerie}
            topRated={topRated}
            diagnostic={spotlightSignal}
            nbHausses={nbHausses}
            nbBaisses={nbBaisses}
            volumeTotal={volumeTotal}
            nbTransactions={nbTransactions}
          />
        );
      })()}

      {/* ── RÉASSURANCE : sortie du hero (§4.7 — le hero porte la promesse et
          le CTA, pas un bandeau de confiance). Rendue ici, juste sous le
          hero, en tokens de thème puisqu'on quitte le fond sombre fixe. ── */}
      <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-muted">
        {['Aucune carte bancaire', 'Compte en 1 minute', 'Sans engagement'].map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor"
                 strokeWidth="2" className="text-up" aria-hidden>
              <path d="M3 8.5l3.2 3.2L13 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t}
          </li>
        ))}
      </ul>

      {/* ── BADGES DE CONFIANCE (preuve produit factuelle) ────────────── */}
      <ProofBand nbActions={nbActions} />

      {/* ── 04 · COMBIEN ÇA COÛTE ────────────────────────────────
          Le tarif était en position 19 sur 21 écrans en mobile : le visiteur
          qui se demande « combien ça coûte » devait parcourir toute la page,
          puis la quitter, pour l'apprendre. Il remonte juste après la preuve,
          là où la question se pose réellement. ────────────────────── */}
      {/* AppPreview porte les badges GRATUIT / PREMIUM / UNIQUE : c'est de
          l'information de palier, sa place est ici et non en section 14 où
          elle répétait le message de PlatformUniverses juste au-dessus. */}
      <AppPreview nbObligations={nbObligations} />

      <PremiumCompare plans={plans} />


      {/* ── MARCHÉ EN DIRECT : actus, séance, preuve chiffrée, indices,
          heatmap — remonté juste après ProofBand (preuve de fraîcheur des
          données, elle doit être visible tôt) ; regroupés en un seul bloc
          contigu (avant : 4 sections séparées par des mt-10). ──────────── */}
      <section className="mt-10">
        <div className="mb-5 flex items-baseline justify-between gap-3">
          <p className="overline text-gold-2">Marché en direct</p>
          <span className="overline text-faint">Actualisé toutes les 15 min en séance</span>
        </div>


        <p className="mt-6 max-w-[56ch] text-base leading-[1.75] text-muted">
          Cours actualisés toutes les 15 minutes, note A–F sur chaque action, fondamentaux extraits des
          publications officielles, simulateur et brief quotidien. L&apos;essentiel est gratuit.
        </p>

        {/* État du marché : même composant que le dashboard. Il concentre
            hausses / baisses / stables / titres, la répartition en barre, le
            volume, les transactions et la jauge de sentiment. Il remplace une
            carte BRVM-C qui n'affichait que deux chiffres pour beaucoup de vide
            — la valeur de l'indice reste visible dans le hero et dans la carte
            Indices juste à côté. */}
        {marketStats && (
          <div className="mt-4">
            <MarketStateCard
              stats={marketStats}
              sentimentScore={sentimentScore}
              sentimentDelta={sentimentDelta}
              breakdown={breakdown}
              headingLevel={2}
            />
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-panel border border-border bg-surface/60 p-5">
            <p className="overline mb-3 text-up">Top hausses</p>
            <div className="space-y-2">
              {hausses.length > 0 ? (
                hausses.map((m, i) => <MoverLine key={m.code} m={m} rank={i + 1} />)
              ) : flatTopA.length > 0 ? (
                <>
                  <p className="mb-1 text-[11px] text-muted">Séance peu animée — titres les plus échangés :</p>
                  {flatTopA.map((m, i) => (
                    <MoverLine key={m.code} m={m} rank={i + 1} />
                  ))}
                </>
              ) : (
                <p className="py-6 text-center text-xs text-faint">Aucune hausse signée cette séance.</p>
              )}
            </div>
          </div>
          <div className="rounded-panel border border-border bg-surface/60 p-5">
            <p className="overline mb-3 text-down">Top baisses</p>
            <div className="space-y-2">
              {baisses.length > 0 ? (
                baisses.map((m, i) => <MoverLine key={m.code} m={m} rank={i + 1} />)
              ) : flatTopB.length > 0 ? (
                <>
                  <p className="mb-1 text-[11px] text-muted">Séance peu animée — titres les plus échangés :</p>
                  {flatTopB.map((m, i) => (
                    <MoverLine key={m.code} m={m} rank={i + 1} />
                  ))}
                </>
              ) : (
                <p className="py-6 text-center text-xs text-faint">Aucune baisse signée cette séance.</p>
              )}
            </div>
          </div>
          {/* 4ᵉ colonne : indices en liste compacte (la variante pleine
              largeur, LandingIndices, ne tient pas dans une colonne). */}
          <IndicesCompactCard indices={indices} />
        </div>
      </section>

      {/* ── 07 · SECTEURS — variation du jour, calculée (lib/landing/sectors.ts)  */}
      <SectorStrip sectors={sectors} dateLabel={dateLabel} />

      {/* ── 08 · CARTOGRAPHIE — pleine largeur, section immersive ───────── */}
      {/* Cartographie en bande sombre : première rupture de rythme de la page.
          LandingHeatmap porte déjà son titre « Toute la cote BRVM », ne pas en
          ajouter un second au-dessus — il faisait doublon à l'écran. */}
      <div className={GAP_CHAPITRE}>
        <DarkBand>
          <LandingHeatmap rows={heatmapRows} dateLabel={dateLabel} />
        </DarkBand>
      </div>

      {/* ── 08 bis · LA SÉANCE EN VIDÉO ──────────────────────────────────
          Produite chaque soir par le worker video/ depuis les mêmes données
          que la page. Placée après la cartographie : la démonstration
          chiffrée est faite, la vidéo la résume avant le CTA. Disparaît
          d'elle-même tant qu'aucune vidéo n'est publiée. ──────────────── */}
      <VideoSeance data={videoSeance} dateMarche={asOf} />

      {/* ── CTA DE MI-PARCOURS ───────────────────────────────
          Entre le hero et la fin de page, le visiteur mobile traversait 15
          écrans sans une seule sortie vers l'inscription. Ce CTA arrive après
          la cartographie, quand la démonstration a déjà convaincu. ─────── */}
      <section className={`${GAP_SECTION} text-center`}>
        <Link
          href="/signup"
          className="landing-hero-cta inline-flex min-h-[50px] items-center gap-1.5 rounded-full px-8 text-sm font-bold text-[#03222b] shadow-gold transition-transform active:scale-95"
        >
          Créer mon compte gratuit <span aria-hidden>→</span>
        </Link>
        <p className="mt-3 text-xs text-muted">Sans carte bancaire · 1 minute · Accès immédiat.</p>
      </section>

      {/* ── 09 · COMPRENDRE UNE ACTION — fiche société réelle ───────────── */}
      <StockSpotlight stock={featured} dateLabel={dateLabel} />

      {/* ── 10 · FONDAMENTAUX ───────────────────────────────────────────── */}
      <FundamentalsPreview data={fundamentals} />

      {/* ── 11 · SIGNATURE — la note A–F ────────────────────────────────── */}
      <RatingSpotlight signal={spotlightSignal} nbActions={nbActions} />

      {/* Deuxième rupture de rythme : le Diagnostic IA est un moment de
          DONNÉES, il passe donc en bande sombre comme la cartographie. */}
      <div className={GAP_CHAPITRE}>
        <DarkBand>
        {/* ── 12 · DIAGNOSTIC IA ──────────────────────────────────────────── */}
        <section className={`grid grid-cols-1 gap-4 lg:grid-cols-2`}>
          <article className={ROW_CARD}>
            <p className="overline mb-2 text-gold-2">Diagnostic IA</p>
            <h2 className="mb-3 font-display text-lg text-ivory">Votre analyste BRVM en quelques secondes.</h2>
            {latestDiagnosticReport ? (
              <div className="rounded-xl border border-border/70 bg-sunken/30 p-3.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-ivory">{latestDiagnosticReport.code}</span>
                  {latestDiagnosticReport.generated_at && (
                    <span className="text-[10px] text-faint">
                      {new Date(latestDiagnosticReport.generated_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>
                <p className="line-clamp-4 text-[13px] leading-relaxed text-ivory/85">
                  {excerpt(latestDiagnosticReport.markdown_content ?? "", 200)}
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-border/70 bg-sunken/30 p-3.5 text-[13px] text-faint">
                Un exemple de diagnostic s&apos;affichera ici dès qu&apos;un rapport aura été généré.
              </p>
            )}
            <p className="mt-3 text-[10px] leading-relaxed text-faint">
              Analyse façon sell-side générée à partir des données réelles de la plateforme — un outil
              d&apos;analyse, jamais une recommandation d&apos;achat ou de vente.
            </p>
            <Link href="/premium/diagnostic" className={ROW_LINK}>
              Découvrir le Diagnostic IA <span aria-hidden>→</span>
            </Link>
          </article>
          <article className={ROW_CARD}>
            <p className="overline mb-2 text-gold-2">Premium</p>
            <h2 className="mb-3 font-display text-lg text-ivory">Passez à Premium</h2>
            {premiumPlan ? (
              <>
                <p className="tabular font-display text-2xl text-ivory">
                  {premiumPlan.price_monthly > 0
                    ? `${premiumPlan.price_monthly.toLocaleString('fr-FR')} FCFA`
                    : 'Gratuit'}
                  {premiumPlan.price_monthly > 0 && <span className="text-xs font-normal text-faint"> /mois</span>}
                </p>
                <p className="mt-0.5 text-[11px] text-faint">Formule {premiumPlan.name}</p>
                <ul className="mt-3 space-y-2">
                  {premiumPlan.features.slice(0, 4).map((f) => (
                    <li key={f.id} className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                      <span className="mt-0.5 text-up" aria-hidden>
                        ✓
                      </span>
                      <span>
                        {f.feature_label}
                        {f.feature_value ? ` — ${f.feature_value}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="rounded-xl border border-border/70 bg-sunken/30 p-3.5 text-[13px] text-faint">
                Le détail des formules s&apos;affichera dès que les plans seront disponibles.
              </p>
            )}
            <Link href="/pricing" className={ROW_LINK}>
              Découvrir Premium <span aria-hidden>→</span>
            </Link>
          </article>
        </section>
        </DarkBand>
      </div>

      {/* ── 13 · DE LA DONNÉE À LA DÉCISION — fil conducteur de la marque ─ */}
      <DataToDecision />

      {/* ── 14 · LA PLATEFORME — quatre univers (remplace la grille plate)  */}
      <PlatformUniverses />


      {/* ── 15 + 16 · SIMULATEUR ET COMPARATEUR SGI ─────────────────────── */}
      <section className={`${GAP_SECTION} grid grid-cols-1 gap-4 lg:grid-cols-2`}>
        <article className={ROW_CARD}>
          <p className="overline mb-2 text-gold-2">Simulateur</p>
          <h2 className="mb-3 font-display text-lg text-ivory">Et si vous aviez investi&nbsp;?</h2>
          {simulation ? (
            <>
              <p className="text-xs leading-relaxed text-muted">
                1 000 000 FCFA dans SONATEL il y a 5 ans, aujourd&apos;hui :
              </p>
              <p className="tabular mt-1.5 font-display text-3xl text-ivory">
                {fmtNumber(Math.round(simulation.finalValue))} <span className="text-base text-muted">FCFA</span>
              </p>
              <p className={`tabular mt-1 text-sm font-bold ${simulation.pct >= 0 ? 'text-up' : 'text-down'}`}>
                {simulation.pct >= 0 ? '+' : ''}
                {fmtNumber(simulation.pct, 1)} % · dividendes inclus
              </p>
              <p className="mt-3 text-[10px] leading-relaxed text-faint">
                Calcul réel sur les cours de clôture. Performances passées ne préjugent pas des performances futures.
              </p>
            </>
          ) : (
            <p className="rounded-xl border border-border/70 bg-sunken/30 p-3.5 text-[13px] text-faint">
              Le calcul s&apos;affichera dès que l&apos;historique sera disponible.
            </p>
          )}
          <Link href="/simulateur" className={ROW_LINK}>
            Tester une autre action <span aria-hidden>→</span>
          </Link>
        </article>
        <article className={ROW_CARD}>
          <p className="overline mb-2 text-gold-2">Comparateur · SGI</p>
          <h2 className="mb-3 font-display text-lg text-ivory">Choisissez votre SGI en toute clarté.</h2>
          <p className="text-sm leading-relaxed text-muted">
            Annuaire complet des {sgiCount} SGI agréées de l&apos;UEMOA — pays, type, groupe, dépôt minimum indicatif —
            et un calculateur de coût réel (courtage, garde, tenue de compte).
          </p>
          <p className="mt-3 font-mono text-[12px] text-faint">{sgiCount} SGI · 7 pays UEMOA</p>
          <ul className="mt-2 space-y-1">
            {sgiPaysLines.map((l) => (
              <li key={l} className="font-mono text-[12.5px] text-muted">
                {l}
              </li>
            ))}
          </ul>
          <Link href="/comparateur-sgi" className={ROW_LINK}>
            Comparer les {sgiCount} SGI <span aria-hidden>→</span>
          </Link>
        </article>
      </section>

      {/* ── 17 · BRIEF QUOTIDIEN ET ACTUALITÉS ──────────────────────────── */}
      <section className={`${GAP_SECTION} grid grid-cols-1 gap-4 lg:grid-cols-2`}>
        <article className={ROW_CARD}>
          <p className="overline mb-2 text-gold-2">Brief quotidien</p>
          <h2 className="mb-3 font-display text-lg text-ivory">La séance résumée chaque soir.</h2>
          {briefLines.length > 0 ? (
            <ul className="space-y-2">
              {briefLines.slice(0, 5).map((l, i) => (
                <li key={i} className="border-b border-border/60 pb-2 text-[13px] leading-snug text-ivory/85 last:border-0 last:pb-0">
                  {l}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-border/70 bg-sunken/30 p-3.5 text-[13px] text-faint">
              Le brief du jour sera disponible après la clôture.
            </p>
          )}
          <Link href="/brief" className={ROW_LINK}>
            Lire le brief <span aria-hidden>→</span>
          </Link>
        </article>
        <article className={ROW_CARD}>
          <p className="overline mb-2 text-gold-2">Communauté</p>
          <h2 className="mb-3 font-display text-lg text-ivory">Vous n&apos;analysez pas seul.</h2>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-up" />
            </span>
            <span className="tabular font-display text-2xl font-semibold text-accent">{TIKTOK_FOLLOWERS}</span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            abonnés suivent nos analyses de la BRVM sur{' '}
            {TIKTOK_URL ? (
              <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer" className="text-ivory underline decoration-border underline-offset-2 hover:text-gold-2">
                TikTok
              </a>
            ) : (
              'TikTok'
            )}
            .
          </p>
          {memberCount != null && (
            <p className="mt-2 text-[11px] text-faint">
              <span className="tabular text-muted">{nf(memberCount)}</span> comptes créés sur WESTBOURSE —
              la fiche des sociétés se consulte sans inscription.
            </p>
          )}
          <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-faint">
            Données vérifiées · sources officielles
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/brvm-logo.png" alt="BRVM" className="h-5 w-auto opacity-70 grayscale" />
            {PROOF_SOURCES.map((s) => (
              <span key={s} className="font-mono text-[11.5px] font-medium text-muted/70">
                {s}
              </span>
            ))}
          </div>
          <Link href="/signup" className={ROW_LINK}>
            Rejoindre la communauté <span aria-hidden>→</span>
          </Link>
        </article>
      </section>

      {/* ── 2 CARTES : Analyse · Actualités ───────────────────────────── */}
      <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Carte 1 — Analyse exclusive → inscription */}
        <article className="flex flex-col rounded-panel border border-border bg-surface p-6 transition-all hover:border-accent/40 hover:bg-elevated/70">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-up/30 bg-up/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-up">
            <span className="h-1.5 w-1.5 rounded-full bg-up" /> Données vérifiées
          </span>
          <h3 className="mt-4 font-display text-xl text-ivory">Accédez à des analyses exclusives</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
            Note A–F sur chaque action, signaux quantitatifs, watchlist et alertes. L&apos;essentiel est
            gratuit — créez votre compte en 1 minute.
          </p>
          <Link
            href="/signup"
            className="mt-5 inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-full border border-up/40 px-5 text-sm font-semibold text-up transition-colors hover:bg-up/10"
          >
            Créer mon compte gratuit <span aria-hidden>→</span>
          </Link>
        </article>

        {/* Carte 2 — Actualités du marché (vraies données brvm_news) */}
        <article className="flex flex-col rounded-panel border border-border bg-surface p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl text-ivory">Actualités du Marché</h3>
            <Link href="/actualites" className="text-[11px] text-muted transition-colors hover:text-ivory">
              Tout voir →
            </Link>
          </div>
          {news.length > 0 ? (
            <ul className="mt-4 flex-1 space-y-3">
              {news.slice(0, 3).map((n) => {
                const dateLabelN = n.date_publication
                  ? new Date(n.date_publication).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                  : null;
                const inner = (
                  <>
                    <p className="line-clamp-2 text-sm leading-snug text-ivory/90 transition-colors group-hover:text-gold-2">
                      {n.titre}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-[10px] text-faint">
                      {n.instrument_code && <span className="tabular font-medium text-muted">{n.instrument_code}</span>}
                      {dateLabelN && <span>{dateLabelN}</span>}
                    </p>
                  </>
                );
                return (
                  <li key={n.id} className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
                    {n.source_url ? (
                      <a href={n.source_url} target="_blank" rel="noopener noreferrer" className="group block">
                        {inner}
                      </a>
                    ) : (
                      <div className="group">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 flex-1 py-6 text-center text-sm text-faint">
              Aucune actualité disponible pour le moment.
            </p>
          )}
        </article>
      </section>

      {/* ── 20 · NEWSLETTER ─────────────────────────────────────────────── */}
      <section className="mt-14">
        <NewsletterForm source="landing" banner />
      </section>

      {/* ── 21 · FAQ — lève les objections avant le CTA final ───────────── */}
      <LandingFaq />

      {/* ── 22 · CTA FINAL ──────────────────────────────────────────────── */}
      <section className="mt-16 text-center">
        <h2 className="mx-auto mb-3 max-w-[24ch] font-display text-3xl text-ivory md:text-5xl [letter-spacing:-0.04em]">
          Votre prochaine décision mérite mieux qu&apos;une intuition.
        </h2>
        <p className="mb-7 text-sm text-muted">Sans carte bancaire · 1 minute · Accès immédiat.</p>
        <Link
          href="/signup"
          className="landing-hero-cta inline-flex min-h-[52px] items-center rounded-full px-9 text-base font-bold text-[#03222b] shadow-gold transition-transform active:scale-95"
        >
          Créer mon compte gratuit
        </Link>
      </section>

    </div>
  );
}
