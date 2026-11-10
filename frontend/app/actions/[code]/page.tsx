import { notFound } from 'next/navigation';
import Link from 'next/link';
import { BellPlus, Download, FileText, History, MessageSquareText, Star } from 'lucide-react';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getAdminContext, can } from '@/lib/server/rbac';
import { createPublicClient } from '@/lib/supabase/public';
import { chargerIntermediaire } from '@/lib/financials/interimServer';
import FreshnessBadge from '@/components/FreshnessBadge';
import { computeFreshness } from '@/lib/freshness';
import { loadFreshnessInputs } from '@/lib/freshness/queries';
import { canAccess } from '@/lib/server/featureAccess';
import { SectionLock } from '@/components/premium/SectionLock';
import ChartBuilder from '@/components/financials/ChartBuilder';
import { buildChartRows } from '@/lib/financials/chartBuilder';
import { loadCompanyFinancials } from '@/lib/financials/queries';
import brvmLogos from '@/lib/brvmLogos.json';

const LOGOS = brvmLogos as Record<string, string>;

/** Origine CANONIQUE : westbourse.com redirige en 308 vers www — un canonical qui
 *  pointerait vers la version sans www diluerait le signal entre deux URL. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.westbourse.com';
import PriceChart, { type PricePoint, type ChartMarker } from '@/components/PriceChart';
import EventMarkerLegend from '@/components/EventMarkerLegend';
import IndicatorCharts, { type IndicatorPoint } from '@/components/IndicatorCharts';
import RsiCursor from '@/components/RsiCursor';
import SignalBadge from '@/components/SignalBadge';
import RatingBadge from '@/components/RatingBadge';
import { VerdictBand } from '@/components/actions/VerdictBand';
import { FicheStickyNav } from '@/components/actions/FicheStickyNav';
import PublicationsModal, { type Publication } from '@/components/PublicationsModal';
import FundamentalsPanel from '@/components/fundamentals/FundamentalsPanel';
import { ligneVerdict, volumeAuDessusMoyenne, dividendeCourant, evolutionResultat, evolutionResultatDetail, horsExploitation, syntheseExercice, formatRendementDividende, rendementDividendeParts, nombreFr, pctFr, insecable, libelleEvenement } from '@/lib/fiche/affichage';
import { plageSurFenetre, plageSeance } from '@/lib/fiche/plages';
import { exerciceRetenu, mentionSecondJeu } from '@/lib/fiche/exerciceRetenu';
import { ratiosBilan } from '@/lib/fiche/ratiosBilan';
import { comptesIfrs } from '@/lib/fiche/comptesIfrs';
import { chargerComptesIfrs } from '@/lib/fiche/comptesIfrsServeur';
import ComptesIfrs from '@/components/fiche/ComptesIfrs';
import { ProfilPresentation, ProfilHistorique, ProfilListe, PointsCles, ProfilDirection, ProfilActionnariat, ProfilIdentite, NoteSources } from '@/components/fiche/ProfilSociete';
import { SousSection } from '@/components/fiche/SousSection';
import { DonneeAbsente } from '@/components/fiche/DonneeAbsente';
import { ActualitesValeur } from '@/components/fiche/ActualitesValeur';
import { ViewTracker } from '@/components/analytics/ViewTracker';
import { fraicheurComptes } from '@/lib/fiche/fraicheur';
import { normaliserProfil } from '@/lib/fiche/profilSociete';
import { RUBRIQUES, rubriqueDepuis, hrefRubrique } from '@/lib/fiche/rubriques';
import { pointsCles } from '@/lib/fiche/pointsCles';
import { capitalisationFcfa } from '@/lib/fiche/capitalisation';
import { lectureTechnique } from '@/lib/fiche/lecture';
import { decomposerScore } from '@/lib/fiche/quant';
import { chaineGardeFous, resumeGardeFous } from '@/lib/fiche/quantTextes';
import { libelleSignal } from '@/lib/signalLabel';
import { Chapitre } from '@/components/fiche/Chapitre';
import { Essentiel, type CarteEssentiel } from '@/components/fiche/Essentiel';
import { AnalyseIA } from '@/components/fiche/AnalyseIA';
import { JaugesPlage } from '@/components/fiche/JaugesPlage';
import { SeanceIntraday } from '@/components/fiche/SeanceIntraday';
import { LectureTechnique } from '@/components/fiche/LectureTechnique';
import { CombinedAlphaCarte } from '@/components/fiche/CombinedAlphaCarte';
import { StatsEtCours, AProposBloc } from '@/components/fiche/VueEnsemble';
import { lignesStatistiques, phrasePerformance, serieAnnuelle, dateEnLettres, libelleFamille } from '@/lib/fiche/overview';
import { regrouperActualites, type NewsEntree } from '@/lib/fiche/overviewActualites';
import { seriesParPeriode } from '@/lib/fiche/overviewSeries';
import { depuisPremiereTransaction } from '@/lib/fiche/seance';
import { nomPays } from '@/lib/crm/geo';
import { BeginnerHint } from '@/components/BeginnerHint';
import { pickBestFundamental } from '@/lib/fundamentals';
import { computeLiquidity, fromDailyRow, type LiquidityDailyRow } from '@/lib/liquidity';
import { LiquidityCard } from '@/components/LiquidityCard';
import CarnetOrdres, { type CarnetRow } from '@/components/CarnetOrdres';
import CarnetCommentaire from '@/components/CarnetCommentaire';
import { ecartTypeVariations } from '@/lib/carnet/commentaire';
import { selectionnerEvenements, type EvenementMarche, type MesureEvenement } from '@/lib/carnet/evenements';
import { eventStudy, type DatedClose } from '@/lib/eventStudy';
import { getSgiFrais } from '@/lib/sgi-frais/queries';
import { fmtNumber, fmtFcfa, fmtDateCourte, fmtPctAbs } from '@/lib/format';
import { smaSeries, rsiSeries, macdSeries, bollingerSeries, detect, stochasticSeries, cciSeries } from '@/lib/indicators';
import { computeTechnicalSummary } from '@/lib/technicalSummary';
import type { TechnicalSummaryResult } from '@/lib/technicalSummary';
import NotationBadge from '@/components/NotationBadge';
import { scoreToRating } from '@/lib/rating';

function noteAF(score: number | null, confiance: number | null): string | null {
  const n = scoreToRating(score, confiance).note;
  return n === 'NR' ? null : n;
}
import SignalAnalysis from '@/components/SignalAnalysis';
import ValuationPanel from '@/components/ValuationPanel';
import { getValuation } from '@/lib/valuation/server';
import { getScoring } from '@/lib/scoring/server';
import { listTopics } from '@/lib/forum/server';
import { ForumTopicList } from '@/components/forum/ForumTopicList';
import { readTechnical } from '@/lib/signal/technical';
import { analyzeDividendTiming } from '@/lib/signal/dividendTiming';
import { rendementNetSelonBase, type BaseFiscale } from '@/lib/tax/compute';
import { toPaysUemoa } from '@/lib/tax/rates';
import { readPosition } from '@/lib/signal/position';
import { synthesize } from '@/lib/signal/synthesis';
import ThesisPanel from '@/components/theses/ThesisPanel';
import ActionMenu from '@/components/actions/ActionMenu';
import SeasonalityCard from '@/components/seasonality/SeasonalityCard';
import { getMonthlyReturns } from '@/lib/seasonality/server';
import type { ActionDaily, SignalDaily } from '@/lib/types';
import {
  SectionHeader,
  PremiumPanel,
  MetricCard,
  StatPill,
  EmptyStatePremium,
  PremiumCTA,
} from '@/components/ui/premium';

/**
 * TITRE UNIQUE PAR TITRE COTÉ — le correctif SEO le plus important du site.
 *
 * Sans `generateMetadata`, les 47 fiches héritaient TOUTES du titre par défaut du
 * layout : « WESTBOURSE — Cours BRVM, Notes A–F & Analyses Quantitatives ». Google
 * voyait 47 pages jumelles, ne savait laquelle servir, et en piochait une au
 * hasard : une recherche sur la marque remontait /actions/SLBC, pas l'accueil.
 *
 * Chaque fiche annonce désormais SA société et SON cours. C'est ce qui permet de
 * répondre aux requêtes qui comptent : « cours SONATEL », « action BOA », etc.
 *
 * Le suffixe « | WESTBOURSE » est ajouté par le gabarit du layout — ne pas le
 * remettre ici, sous peine de le voir apparaître deux fois (bug corrigé).
 */
export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const code = decodeURIComponent(params.code).toUpperCase();
  const sb = createPublicClient();

  const [{ data: instr }, { data: last }] = await Promise.all([
    sb.from('brvm_instruments').select('designation, secteur').eq('code', code).maybeSingle(),
    sb.from('brvm_actions_daily').select('cours_jour, variation_pct')
      .eq('code', code).not('cours_jour', 'is', null)
      .order('date_marche', { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (!instr) return { title: `${code} — action BRVM` };

  const nom = (instr as { designation: string | null }).designation ?? code;
  const cours = (last as { cours_jour: number | null } | null)?.cours_jour ?? null;
  const coursTxt = cours ? `${new Intl.NumberFormat('fr-FR').format(cours)} FCFA` : null;

  return {
    title: `${nom} (${code}) · cours, dividendes et analyse BRVM`,
    /**
     * NOINDEX — et c'est délibéré.
     *
     * /actions/[code] et /societes/[code] parlent du MÊME titre coté : deux URL
     * pour un sujet, c'est de la cannibalisation — Google ne sait laquelle servir
     * et les deux s'affaiblissent. De plus, cette page-ci est désormais largement
     * verrouillée : Googlebot, visiteur anonyme, n'y verrait qu'un mur de cadenas.
     *
     * On désigne donc explicitement /societes/[code] comme LA page publique
     * indexable (riche, ouverte), et /actions/[code] comme l'application.
     * `follow` reste actif : les liens sortants continuent de transmettre leur jus.
     */
    robots: { index: false, follow: true },
    description: coursTxt
      ? `${nom} (${code}) cote ${coursTxt} à la BRVM. Cours actualisé toutes les 15 min, historique, dividendes versés, saisonnalité et analyse. Données vérifiées.`
      : `${nom} (${code}) à la BRVM : cours, historique, dividendes versés, saisonnalité et analyse. Données vérifiées.`,
    alternates: { canonical: `${SITE_URL}/societes/${code}` },
    openGraph: {
      title: `${nom} (${code}) · cours BRVM`,
      description: coursTxt ? `${coursTxt} — cours, dividendes et analyse.` : 'Cours, dividendes et analyse.',
      url: `${SITE_URL}/actions/${code}`,
      type: 'website',
    },
  };
}

export const dynamic = 'force-dynamic';

// 600 séances ≈ 2,3 ans BRVM (260 j/an) — nécessaire pour MA200 + 2 ans de backtest
const HISTORY = 600;

async function getData(code: string, fromDate?: string) {
  const supabase = createClient();

  let histQuery = supabase
    .from('brvm_actions_daily')
    .select('*')
    .eq('code', code)
    .order('date_marche', { ascending: false })
    .limit(HISTORY);

  if (fromDate) histQuery = histQuery.gte('date_marche', fromDate);

  // Position de l'utilisateur connecté (pour une lecture du signal selon le PRU).
  const { data: { user } } = await supabase.auth.getUser();
  const positionPromise = user
    ? supabase
        .from('portfolios_positions')
        .select('quantite, prix_entree')
        .eq('user_id', user.id)
        .eq('code', code)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const [{ data: hist }, { data: instr }, { data: sig }, { data: divs }, { data: evts }, { data: pubs }, { count: pubCount }, { data: fundsRows }, { data: position }] =
    await Promise.all([
      histQuery,
      supabase.from('brvm_instruments').select('*').eq('code', code).maybeSingle(),
      supabase
        .from('signals_daily')
        .select('*')
        .eq('code', code)
        .order('date_marche', { ascending: false })
        .limit(1),
      supabase
        .from('dividends')
        .select('montant, ex_date, payment_date, exercice, base_fiscale')
        .eq('code', code)
        // Tri par exercice (toujours renseigné). Trier par ex_date mettait les
        // NULL en tête (PostgREST) et pouvait évincer les lignes datées du limit.
        .order('exercice', { ascending: false, nullsFirst: false })
        .limit(6),
      supabase
        .from('market_events')
        .select('id, title, event_date, event_type, sentiment')
        .eq('instrument_code', code)
        .order('event_date', { ascending: false })
        .limit(4),
      supabase
        .from('publications')
        .select('id, date_publication, libelle, type_publication, source_url')
        .eq('code', code)
        .order('date_publication', { ascending: false })
        .limit(300),
      supabase
        .from('publications')
        .select('*', { count: 'exact', head: true })
        .eq('code', code),
      supabase
        .from('fundamentals')
        .select('year, revenue, net_income, equity, cash, debt, bfr, source_file, is_manual')
        .eq('code', code)
        .order('year', { ascending: false })
        .limit(6),
      positionPromise,
    ]);

  return {
    rows: ((hist ?? []) as ActionDaily[]).reverse(),
    instrument: instr as { designation?: string; secteur?: string; pays?: string; type?: string; shares?: number | null; shares_source?: string | null; flottant?: number | null; vol_moyen_30j?: number | null; notation_json?: {
        agence: string; note: string; perspective: string; date_notation: string; source_url?: string;
        court_terme?: string | null; long_terme?: string | null;
        history?: { note: string; court_terme?: string | null; long_terme?: string | null; perspective: string; date_notation: string }[];
      } | null } | null,
    signal: (sig?.[0] ?? null) as SignalDaily | null,
    dividends: divs ?? [],
    events: evts ?? [],
    publications: (pubs ?? []) as Publication[],
    pubCount: pubCount ?? 0,
    fundamentals: (fundsRows ?? []) as Array<{
      year: number | null; revenue: number | null; net_income: number | null;
      equity: number | null; cash: number | null; debt: number | null; bfr: number | null;
      source_file: string | null; is_manual: boolean | null;
    }>,
    position: (position ?? null) as { quantite: number; prix_entree: number } | null,
  };
}

export default async function InstrumentPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { from?: string; rubrique?: string | string[] };
}) {
  const code = decodeURIComponent(params.code).toUpperCase();

  // Indicateurs techniques (RSI, MACD, moyennes mobiles, lecture, explication IA).
  // Niveau requis LU EN BASE (feature_flags → `indicateurs_techniques`), éditable
  // dans /admin/features. Le cours et le volume, eux, restent publics.
  const [gateIndicateurs, gateSignaux, gateFonda, gateValo, gateLectureSeance] = await Promise.all([
    canAccess('indicateurs_techniques'), // verdict, config technique, RSI/MACD
    canAccess('signaux'),                // signal quantitatif
    canAccess('fondamentaux'),           // analyse fondamentale
    canAccess('dcf'),                    // valorisation
    canAccess('lecture_seance'),         // « Ce que dit la séance » (carnet commenté)
  ]);

  // États financiers complets pour le constructeur de graphique — chargés
  // seulement si l'accès fondamental est ouvert (aucun coût pour les anonymes,
  // qui ne verraient qu'un cadenas de toute façon).
  const financials = gateFonda.allowed ? await loadCompanyFinancials(code) : null;
  const chartRows = financials
    ? buildChartRows(financials.incomeStatements, financials.balanceSheets, financials.cashFlowStatements)
    : [];
  const fromDate = searchParams.from ?? '';
  const rubrique = rubriqueDepuis(searchParams.rubrique);
  const { rows, instrument, signal, dividends, events, publications, pubCount, fundamentals, position } = await getData(code, fromDate || undefined);
  // Bouton « Corriger » réservé aux admins (la route /api/fundamentals revérifie).
  const canEditFondamentaux = can(await getAdminContext(), 'content.write');
  const [valuation, scoring] = await Promise.all([
    getValuation(code).catch(() => null),
    getScoring(code).catch(() => null),
  ]);
  const { topics: forumTopics, authors: forumAuthors } = await listTopics(0, code);

  if (rows.length === 0) {
    // Code inexistant : vrai 404 (pas d'état vide en 200). Instrument connu sans historique : état vide.
    if (!instrument) notFound();
    return (
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <Link
          href="/actions"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent-ink transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        >
          ← Marché actions
        </Link>
        <EmptyStatePremium
          title={`Aucun historique pour ${code}`}
          hint="Les données seront disponibles après la prochaine collecte."
          icon="◈"
          action={{ href: '/actions', label: 'Retour au marché' }}
        />
      </div>
    );
  }

  // Ne calcule les indicateurs que sur les clôtures valides (jamais avec 0 synthétique)
  const closes = rows.map((r) => r.cours_jour ?? null);
  const validCloses = closes.filter((c): c is number => c != null);
  const ma20  = smaSeries(closes.map((c) => c ?? 0), 20).map((v, i) => closes[i] == null ? null : v);
  const ma50  = smaSeries(closes.map((c) => c ?? 0), 50).map((v, i) => closes[i] == null ? null : v);
  const ma200 = smaSeries(closes.map((c) => c ?? 0), 200).map((v, i) => closes[i] == null ? null : v);
  const rsiS  = rsiSeries(validCloses, 14);
  const macdS = macdSeries(validCloses);
  const det   = detect(validCloses);

  // ── Nouveaux indicateurs pour TechnicalSummary ──────────────────────────
  const stochArr = stochasticSeries(validCloses, 14, 3, 3);
  const lastStochPoint = stochArr[stochArr.length - 1] ?? null;
  const lastStochK = lastStochPoint?.k ?? null;

  const cciArr = cciSeries(validCloses, 20);
  const lastCci = cciArr[cciArr.length - 1] ?? null;

  const bbArr = bollingerSeries(validCloses, 20, 2);
  const lastBbPoint = bbArr[bbArr.length - 1] ?? null;
  const lastBbUpper = lastBbPoint?.upper ?? null;
  const lastBbLower = lastBbPoint?.lower ?? null;

  // Réindexe RSI/MACD (calculés sur validCloses) vers rows
  let validIdx = 0;
  const rsiByRow   = rows.map((r) => r.cours_jour != null ? (rsiS[validIdx++] ?? null) : null);
  validIdx = 0;
  const macdByRow  = rows.map((r) => r.cours_jour != null ? (macdS[validIdx++] ?? null) : null);

  const priceData: PricePoint[] = rows.map((r) => ({
    date: r.date_marche,
    close: r.cours_jour,
    volume: r.volume,
  }));

  // ── Marqueurs d'événements pour le graphique ─────────────────────────────
  const chartMarkers: ChartMarker[] = [];

  for (const d of dividends as { montant: number; ex_date: string | null }[]) {
    if (d.ex_date) {
      chartMarkers.push({ date: d.ex_date, label: 'D', color: '#ffb300', title: `Dividende ${d.montant} FCFA` });
    }
  }

  for (const p of publications.slice(0, 20)) {
    chartMarkers.push({ date: p.date_publication, label: 'RT', color: '#7e57c2', title: p.libelle ?? 'Publication' });
  }

  for (const e of events as { event_date: string; event_type: string; title: string }[]) {
    const t = (e.event_type ?? '').toLowerCase();
    let label = 'A'; let color = '#00c853';
    if (t.includes('assembl')) { label = 'AG'; color = '#42a5f5'; }
    else if (t.includes('result') || t.includes('rapport')) { label = 'RT'; color = '#7e57c2'; }
    else if (t.includes('dividend')) { label = 'D'; color = '#ffb300'; }
    chartMarkers.push({ date: e.event_date, label, color, title: e.title });
  }
  const indicatorData: IndicatorPoint[] = rows.map((r, i) => ({
    date: r.date_marche,
    rsi: rsiByRow[i],
    macd: macdByRow[i]?.macd ?? null,
    signal: macdByRow[i]?.signal ?? null,
    hist: macdByRow[i]?.hist ?? null,
  }));

  const last    = rows[rows.length - 1]!;
  const prev    = rows[rows.length - 2] ?? null;
  const up      = (last.variation_pct ?? 0) >= 0;

  // Fraîcheur des cours : dernière collecte intraday + dernière séance en base.
  const fInputs = await loadFreshnessInputs();
  const fraicheur = computeFreshness(fInputs.derniereCollecte, fInputs.derniereSeance, new Date());
  const lastRsi = rsiByRow[rsiByRow.length - 1];
  const lastMacd = macdByRow[macdByRow.length - 1];
  const lastMa20 = ma20[ma20.length - 1] ?? null;
  const technicalSummary: TechnicalSummaryResult = computeTechnicalSummary({
    lastClose: validCloses[validCloses.length - 1] ?? null,
    ma20Last: lastMa20,
    macdVal: lastMacd?.macd ?? null,
    macdSignal: lastMacd?.signal ?? null,
    rsiVal: lastRsi ?? null,
    bbUpper: lastBbUpper,
    bbLower: lastBbLower,
    stochK: lastStochK,
    cci: lastCci,
    dmiPlus: null,
    dmiMinus: null,
  });
  const lastMa50 = ma50[ma50.length - 1] ?? null;
  const lastMa200 = ma200[ma200.length - 1] ?? null;

  // Variation absolue
  const varAbs = last.cours_precedent != null && last.cours_jour != null
    ? last.cours_jour - last.cours_precedent : null;

  // Comptes du dernier exercice publié, et celui d'avant pour l'évolution.
  const exBrut = fundamentals.length > 0 ? pickBestFundamental(fundamentals) : null;
  // Un exercice sans année n'est pas exploitable : on n'en tire rien plutôt que de deviner.
  const exCourant = exBrut?.year != null ? (exBrut as typeof exBrut & { year: number }) : null;
  const exPrecedent = exCourant ? fundamentals.find((f) => f.year === exCourant.year - 1) ?? null : null;

  // Rendement dividende — SOURCE UNIQUE : `dividendeCourant` (dernier dividende
  // > 0, lignes triées par exercice décroissant). Pastille, grille de séance,
  // fondamentaux et bloc dividendes lisent tous cette même ligne, et chaque
  // rendement affiché porte son exercice.
  const divRows = dividends as { montant: number; ex_date: string | null; exercice: number | null; payment_date?: string | null; base_fiscale?: BaseFiscale }[];
  const divCourant = dividendeCourant(
    divRows.map((d) => ({ montant: d.montant, exercice: d.exercice, ex_date: d.ex_date, payment_date: d.payment_date ?? null })),
    exCourant?.year ?? null,
  );
  // Même ligne que `divCourant` (premier montant > 0), avec sa base fiscale.
  const lastDiv = divCourant ? divRows.find((d) => d.montant > 0 && d.exercice != null) ?? null : null;
  const divExercice = divCourant?.exercice ?? null;
  const divYieldTexte = (v: number | null) => formatRendementDividende(v, divExercice);
  const divYield = lastDiv && last.cours_jour && last.cours_jour > 0
    ? (lastDiv.montant / last.cours_jour) * 100 : null;

  // Capitalisation boursière en MFCFA : valorisation scrapée (Sika) en priorité,
  // sinon calcul cours × shares.
  const shares = instrument?.shares ?? null;
  const capitalisationBrute = capitalisationFcfa({ valorisation: last.valorisation != null ? Number(last.valorisation) : null, cours: last.cours_jour ?? null, titres: shares });

  // Comptes retenus (SYSCOHADA : income/balance), source unique des ratios publics ; `fundamentals` en repli.
  const retenu = exerciceRetenu({ income: financials?.incomeStatements ?? [], balance: financials?.balanceSheets ?? [], fundamentals });
  const ratiosPublics = ratiosBilan({
    cours: last.cours_jour ?? null, titres: shares,
    resultatNet: retenu.resultatNet, chiffreAffaires: retenu.chiffreAffaires,
    capitauxPropres: retenu.capitauxPropres, detteFinanciere: retenu.detteFinanciere,
    capitalisation: capitalisationBrute,
  });
  const mentionJeu = mentionSecondJeu(retenu.secondJeu);
  // Comptes IFRS du même exercice, s'ils sont publiés : en regard, jamais à la place des SYSCOHADA.
  const comparatifIfrs = retenu.source === 'syscohada'
    ? comptesIfrs({
      ligne: await chargerComptesIfrs(createClient(), code, retenu.exercice),
      exercice: retenu.exercice,
      syscohada: { resultatNet: retenu.resultatNet, chiffreAffaires: retenu.chiffreAffaires, capitauxPropres: retenu.capitauxPropres, detteFinanciere: retenu.detteFinanciere },
      cours: last.cours_jour ?? null, titres: shares, capitalisation: capitalisationBrute,
    })
    : null;

  // Volume moyen 20j
  const recentVols = rows.slice(-20).map((r) => r.volume).filter((v): v is number => v != null);
  const volMoyen = recentVols.length > 0
    ? Math.round(recentVols.reduce((a, b) => a + b, 0) / recentVols.length) : null;

  // Liquidité (30 dernières séances déjà en mémoire) + fourchette de courtage
  // réelle des barèmes SGI en base (pour le coût d'aller-retour).
  const liqRows = rows.slice(-30).map((r) => ({
    volume: r.volume ?? null,
    cours_jour: r.cours_jour ?? null,
    valeur_echangee: (r as { valeur_echangee?: number | null }).valeur_echangee ?? null,
  }));
  // Liquidité v2 (table liquidity_daily) — fallback calcul legacy si table vide.
  const liqDailyClient = createPublicClient();
  const { data: liqRow } = await liqDailyClient
    .from('liquidity_daily')
    .select('*')
    .eq('code', code)
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  const liquidity = fromDailyRow(liqRow as LiquidityDailyRow | null) ?? computeLiquidity(liqRows, liqRows.length);

  // Instantanés intraday de la dernière séance (volume CUMULÉ), pour le graphique de séance.
  const { data: snapRows } = await liqDailyClient
    .from('brvm_intraday_snapshots')
    .select('captured_at, close, volume')
    .eq('code', code)
    .eq('date_marche', last.date_marche)
    .order('captured_at', { ascending: true });
  const instantanes = ((snapRows ?? []) as { captured_at: string; close: number | null; volume: number | null }[]).filter((s) => s.close != null && s.close > 0);

  // Combined Alpha : même lecture que /actions/[code]/quant (dernier run WB_COMBINED_ALPHA).
  const { data: runCA } = await liqDailyClient
    .from('quant_model_runs')
    .select('id')
    .eq('model_code', 'WB_COMBINED_ALPHA')
    .order('calculation_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: scoresCA } = runCA
    ? await liqDailyClient
        .from('quant_model_scores')
        .select('*')
        .eq('security_id', code)
        .eq('run_id', (runCA as { id: string }).id)
        .order('score_date', { ascending: false })
        .limit(1)
    : { data: null };
  const combinedAlphaRow = ((scoresCA as unknown[] | null)?.[0] ?? null) as {
    combined_alpha_score: number | null; price_momentum_score: number | null; value_score: number | null;
    earnings_quality_score: number | null; financial_strength_score: number | null; dividend_quality_score: number | null;
    penalties_json: unknown; score_date: string; rank_global: number | null;
  } | null;
  const combinedAlpha = combinedAlphaRow
    ? {
        score: combinedAlphaRow.combined_alpha_score,
        rang: combinedAlphaRow.rank_global,
        piliers: [
          { libelle: 'Valorisation', valeur: combinedAlphaRow.value_score },
          { libelle: 'Momentum', valeur: combinedAlphaRow.price_momentum_score },
          { libelle: 'Qualité bénéficiaire', valeur: combinedAlphaRow.earnings_quality_score },
          { libelle: 'Solidité financière', valeur: combinedAlphaRow.financial_strength_score },
          { libelle: 'Dividende', valeur: combinedAlphaRow.dividend_quality_score },
        ],
        penalite: Array.isArray(combinedAlphaRow.penalties_json)
          ? (combinedAlphaRow.penalties_json as { points: number }[]).reduce((t, x) => t + (x.points ?? 0), 0)
          : null,
        calculeLe: combinedAlphaRow.score_date,
      }
    : null;
  // Pénalité réellement appliquée : somme pondérée des piliers − score (même calcul que la fiche Quant).
  const decompositionCA = combinedAlpha
    ? decomposerScore(combinedAlpha.piliers.map((x, k) => ({ poids: [30, 25, 20, 15, 10][k]!, valeur: x.valeur })), combinedAlpha.score)
    : null;

  // Carnet d'ordres de la dernière séance PUBLIÉE au bulletin : sa date diffère
  // de celle des cours, le bulletin paraissant après la clôture.
  const { data: carnetRow } = await liqDailyClient
    .from('brvm_carnet_daily')
    .select('date_marche, qte_achat, cours_achat, qte_vente, cours_vente, achat_au_marche, vente_au_marche, cours_reference')
    .eq('code', code)
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  const carnet = (carnetRow ?? null) as CarnetRow | null;

  // Actualités de la valeur — rapprochées de la séance par leur SEULE date.
  // Jamais datées dans le futur : une publication à venir ne commente pas une
  // séance passée.
  const { data: actusRows } = await liqDailyClient
    .from('brvm_news')
    .select('titre, date_publication')
    .not('hidden', 'is', true) // modération rédactionnelle
    .eq('instrument_code', code)
    .lte('date_publication', new Date().toISOString().slice(0, 10))
    .order('date_publication', { ascending: false })
    .limit(3);
  const actualites = (actusRows ?? []) as { titre: string; date_publication: string }[];

  // Fourchettes du marché à la même séance : sans elles, « 1,75 % » ne se
  // compare à rien. Seules les valeurs dont la fourchette est RÉELLEMENT
  // mesurée entrent dans le classement — jamais celles qui n'en ont pas.
  const seanceLiq = (liqRow as { date_marche?: string } | null)?.date_marche ?? null;
  const { data: spreadRows } = seanceLiq
    ? await liqDailyClient.from('liquidity_daily').select('spread_pct').eq('date_marche', seanceLiq).not('spread_pct', 'is', null)
    : { data: null };
  const spreads = ((spreadRows ?? []) as { spread_pct: number }[]).map((r) => r.spread_pct).sort((a, b) => a - b);
  const propreSpread = (liqRow as { spread_pct?: number | null } | null)?.spread_pct ?? null;
  const contexteCarnet = spreads.length > 0
    ? {
        valeurEchangee: (last as { valeur_echangee?: number | null }).valeur_echangee ?? null,
        spreadMedianMarche: spreads[Math.floor(spreads.length / 2)]!,
        valeursPlusSerrees: propreSpread != null ? spreads.filter((x) => x < propreSpread).length : null,
        valeursComparees: spreads.length,
      }
    : { valeurEchangee: (last as { valeur_echangee?: number | null }).valeur_echangee ?? null };

  // Agitation ordinaire du titre, mesurée sur son propre historique. Sous
  // 20 séances, `ecartTypeVariations` rend `null` et le mouvement du jour est
  // cité sans être qualifié.
  const { ecartTypePct, seances } = ecartTypeVariations(rows.slice(-31).map((r) => r.variation_pct));
  const bruitSeance = {
    variationPct: last.variation_pct ?? null,
    ecartTypePct,
    seancesObservees: seances,
    volumeRatio: ((signal as { inputs?: { volume_ratio?: number | null } | null } | null)?.inputs)?.volume_ratio ?? null,
  };

  // Trimestre / semestre de l'année en cours, tant que l'exercice n'est pas publié.
  const intermediaire = exCourant ? await chargerIntermediaire(createPublicClient(), code, fundamentals) : null;
  const economieSociete = exCourant
    ? {
        intermediaire,
        exercice: exCourant.year,
        resultatNet: exCourant.net_income ?? null,
        resultatNetPrecedent: exPrecedent?.net_income ?? null,
        chiffreAffaires: exCourant.revenue ?? null,
        chiffreAffairesPrecedent: exPrecedent?.revenue ?? null,
        capitauxPropres: (retenu.exercice === exCourant.year ? retenu.capitauxPropres : null) ?? exCourant.equity ?? null,
        actions: instrument?.shares ?? null,
        coursJour: last.cours_jour ?? null,
        source: exCourant.is_manual ? 'pdf-verified' : null,
      }
    : null;

  // Événements de marché de la société, et ce que le cours a fait après.
  // Chargés SEULEMENT si la lecture de séance est accessible (gateLectureSeance,
  // calculé plus haut) : inutile de payer ces requêtes pour un bloc que
  // <SectionLock> affichera à la place de <CarnetCommentaire>.
  let mesuresEvenements: MesureEvenement[] = [];
  if (gateLectureSeance.allowed) {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    let idxQuery = liqDailyClient
      .from('brvm_indices_daily')
      .select('date_marche, valeur')
      .eq('code', 'BRVMC') // BRVM Composite — même code que lib/reports.ts et app/dashboard/page.tsx.
      .order('date_marche', { ascending: false })
      .limit(HISTORY);
    if (fromDate) idxQuery = idxQuery.gte('date_marche', fromDate);

    const [{ data: evtsRows }, { data: idxRows }] = await Promise.all([
      liqDailyClient
        .from('market_events')
        .select('event_date, event_type, title')
        .eq('instrument_code', code)
        // Jamais un événement daté dans le futur — même principe que les
        // actualités ci-dessus : une publication à venir ne commente pas une
        // séance passée. `selectionnerEvenements` l'exclurait de toute façon,
        // mais filtrer ici évite qu'un événement futur ne prenne, à tort, une
        // des 8 places retenues au détriment d'un événement passé pertinent.
        .lte('event_date', aujourdhui)
        .order('event_date', { ascending: false })
        .limit(8),
      idxQuery,
    ]);

    const retenus = selectionnerEvenements((evtsRows ?? []) as EvenementMarche[], aujourdhui, 3);

    if (retenus.length > 0) {
      const serieTitre: DatedClose[] = rows.map((r) => ({ date: r.date_marche, close: r.cours_jour ?? null }));
      const volumesTitre = rows.map((r) => r.volume ?? null);
      const serieIndice: DatedClose[] = ((idxRows ?? []) as { date_marche: string; valeur: number | null }[])
        .map((r) => ({ date: r.date_marche, close: r.valeur }))
        .reverse(); // desc -> asc, comme `serieTitre`.

      mesuresEvenements = retenus.map((evenement) => {
        const resultat = eventStudy(serieTitre, volumesTitre, serieIndice, evenement.event_date, 5);
        // Ne se fie pas au calendrier : il faut au moins 5 séances COTÉES
        // après J0 dans NOTRE série, pas cinq jours civils (un week-end n'est
        // pas une séance). `eventStudy` referme sa fenêtre sur la dernière
        // séance disponible sans le signaler : c'est cette ligne qui détecte
        // une fenêtre encore ouverte.
        const fenetreComplete = resultat.found && serieTitre.length - 1 - resultat.j0Index >= 5;
        const volumeRatio = fenetreComplete && resultat.avgVolPre != null && resultat.avgVolPre > 0 && resultat.avgVolPost != null
          ? resultat.avgVolPost / resultat.avgVolPre
          : null;
        return {
          evenement,
          // `indexRetPost` NON NUL est exigé, et ce n'est pas une précaution de
          // style. `eventStudy` retombe silencieusement sur le rendement BRUT du
          // titre quand l'indice manque (`: retPost`, eventStudy.ts) tout en
          // continuant de nommer le résultat « excédentaire ». Or l'historique
          // de BRVMC ne remonte qu'au 2026-05-26 : sans cette garde, un
          // événement d'octobre 2025 affichait « 24,51 % de moins bien que le
          // BRVM Composite » alors qu'aucune comparaison à l'indice n'avait eu
          // lieu. Mieux vaut aucune mesure qu'une mesure dont l'étalon est
          // absent.
          surperformancePct:
            fenetreComplete && resultat.indexRetPost != null ? resultat.abnormalReturnPost : null,
          volumeRatio,
          fenetreComplete,
        };
      });
    }
  }

  const sgiFrais = await getSgiFrais().catch(() => []);
  const courtages = sgiFrais
    .map((f) => f.courtagePctMax ?? f.courtagePctMin)
    .filter((c): c is number => c != null && c > 0);
  const courtageMin = courtages.length > 0 ? Math.min(...courtages) : null;
  const courtageMax = courtages.length > 0 ? Math.max(...courtages) : null;

  const pays = instrument?.pays ?? last.pays ?? null;
  const secteur = instrument?.secteur ?? last.secteur ?? null;

  // Rendement dividende net d'IRVM, selon la BASE du montant : un montant déjà
  // net (calendrier officiel) n'est jamais retaxé — double IRVM corrigée le
  // 2026-10-20. Base inconnue ou taux non confirmé → pas de net affiché.
  const divDejaNet = lastDiv?.base_fiscale === 'net';
  const paysFiscal = toPaysUemoa(pays);
  const divNetRes = divYield != null && paysFiscal && !divDejaNet
    ? rendementNetSelonBase(divYield, lastDiv?.base_fiscale, paysFiscal)
    : ({ indisponible: true } as const);
  const divYieldNet = divNetRes.indisponible ? null : divNetRes.valeur;

  // ── Plages : 1 jour (plus bas / plus haut publiés), 52 semaines, 2 ans ──
  const serieCours = rows.map((r) => ({ date_marche: r.date_marche, cours_jour: r.cours_jour ?? null }));
  const plageJour = plageSeance(last.plus_bas ?? null, last.plus_haut ?? null, last.cours_jour ?? null);
  const plage52 = plageSurFenetre(serieCours, last.date_marche, 365, last.cours_jour ?? null);
  const plage2ans = plageSurFenetre(serieCours, last.date_marche, 730, last.cours_jour ?? null);

  // Bandeau verdict : sparkline 30 séances + plage observée sur 2 ans.
  const closeHist = rows.map((r) => r.cours_jour).filter((c): c is number => c != null && c > 0);
  const sparkData = closeHist.slice(-30);
  const verdictLine = ligneVerdict(signal?.signal ?? null, signal?.score_total ?? null, last.variation_pct ?? null);

  // Détections sous forme de checklist
  const detections = [
    { label: 'Hausse de plus de 1 % sur la séance', ok: up && (last.variation_pct ?? 0) > 1 },
    { label: 'Golden Cross (MA20 > MA50)', ok: det.goldenCross },
    { label: 'Volume > moyenne', ok: volumeAuDessusMoyenne(last.volume ?? null, volMoyen) },
    { label: 'Cassure haussière 20j', ok: det.breakoutUp },
    { label: 'Survente RSI < 30', ok: det.oversold },
    { label: 'Surachat RSI > 70', ok: det.overbought },
    { label: 'Death Cross (baissier)', ok: det.deathCross },
    { label: 'Cassure baissière 20j', ok: det.breakoutDown },
  ].filter((d) => d.ok !== undefined);

  // Saisonnalité (série mensuelle compacte ; React.cache déduplique avec /saisonnalite).
  const seasonalityReturns = await getMonthlyReturns(code).catch(() => []);

  // ── Lecture technique unique (remplace jauge, analyse technique, signal et lecture commentée) ──
  const lecture = lectureTechnique({
    cours: last.cours_jour ?? null,
    variationPct: last.variation_pct ?? null,
    ma20: lastMa20,
    ma50: lastMa50,
    ma200: lastMa200,
    macd: lastMacd?.macd ?? null,
    macdSignal: lastMacd?.signal ?? null,
    rsi: lastRsi ?? null,
    volume: last.volume ?? null,
    volumeMoyen: volMoyen,
  });

  // Signal quantitatif : synthèse, lecture du signal, position (PRU), timing dividende.
  const analyseSignal = (() => {
    if (!signal) return null;
    const inp = (signal as SignalDaily & { inputs?: Record<string, number | boolean> | null }).inputs ?? {};
    const num = (k: string): number | null => (typeof inp[k] === 'number' ? (inp[k] as number) : null);
    const technical = readTechnical({
      signal: signal.signal,
      rsi: num('rsi'),
      ma20: num('ma20'),
      ma50: num('ma50'),
      volumeRatio: num('volume_ratio'),
      variationPct: num('variation_pct'),
      incomplet: inp.incomplet === true,
    });
    const dividend = analyzeDividendTiming(
      dividends as { montant: number; ex_date: string | null; payment_date: string | null; exercice: number | null }[],
      last.cours_jour ?? null,
      new Date().toISOString().slice(0, 10),
    );
    const positionCtx = readPosition(position, last.cours_jour ?? null, signal.signal);
    const synthesis = synthesize({
      signal: signal.signal,
      confiance: signal.confiance,
      incomplet: inp.incomplet === true,
      technical,
      position: positionCtx,
      dividend,
    });
    return { technical, dividend, positionCtx, synthesis };
  })();

  const lockSignaux = (
    <SectionLock
      required={gateSignaux.required === 'free' ? 'premium' : gateSignaux.required}
      titre="Signal quantitatif"
      pitch="Le signal BUY / HOLD / SELL, sa note et ses sous-scores expliqués."
    />
  );
  // Verrou premium : sans accès, aucun élément du signal n'atteint le HTML.
  const blocSignal = !gateSignaux.allowed
    ? lockSignaux
    : signal && analyseSignal ? (
        <div className="space-y-4">
          <SignalAnalysis
            signal={signal.signal}
            synthesis={analyseSignal.synthesis}
            technical={analyseSignal.technical}
            position={analyseSignal.positionCtx}
            dividend={analyseSignal.dividend}
            masquerPosition={gateIndicateurs.allowed}
          />
          <SignalPanel signal={signal} />
        </div>
      ) : (
        <p className="text-xs text-faint">Aucun signal calculé pour la dernière séance scorée.</p>
      );

  // ── Dernier exercice : compte de résultat détaillé (si accès fondamental) ──
  const isCourant = exCourant && financials
    ? financials.incomeStatements.find((s) => String(s.periode).slice(0, 4) === String(exCourant.year)) ?? null
    : null;
  const horsExpl = isCourant ? horsExploitation(isCourant.resultat_avant_impots, isCourant.resultat_exploitation) : null;
  const evolutionTexte = exCourant ? evolutionResultat(exCourant.net_income ?? null, exPrecedent?.net_income ?? null) : null;
  const croissanceCaPct = exCourant?.revenue != null && exPrecedent?.revenue != null && exPrecedent.revenue !== 0
    ? ((exCourant.revenue - exPrecedent.revenue) / Math.abs(exPrecedent.revenue)) * 100
    : null;
  const phraseExercice = exCourant
    ? syntheseExercice({
        croissanceCaPct,
        evolution: evolutionResultatDetail(exCourant.net_income ?? null, exPrecedent?.net_income ?? null),
        resultatExploitation: isCourant?.resultat_exploitation ?? null,
        horsExpl,
      })
    : null;
  const detailExercice = exCourant
    ? [
        { label: "Résultat d'exploitation", valeur: isCourant?.resultat_exploitation ?? null },
        { label: 'Hors exploitation', valeur: horsExpl },
        { label: 'Impôt', valeur: isCourant?.impots ?? null },
        { label: 'Résultat net', valeur: exCourant.net_income ?? null },
      ].filter((l) => l.valeur != null)
    : [];

  // ── L'essentiel : un constat par chapitre, tiré des mêmes données ──
  const fr2 = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cartes: CarteEssentiel[] = [];
  if (last.variation_pct != null) {
    const v = last.variation_pct;
    cartes.push({
      href: hrefRubrique('marche', fromDate, 'seance'),
      etiquette: 'Séance',
      titre: Math.round(v * 100) === 0 ? 'Séance stable' : `Séance en ${v > 0 ? 'hausse' : 'baisse'} de ${fmtPctAbs(v)}`,
      detail: carnet && carnet.qte_achat != null && carnet.qte_vente != null
        ? `Carnet du ${fmtDateCourte(carnet.date_marche)} : ${fmtNumber(carnet.qte_achat)} titres demandés, ${fmtNumber(carnet.qte_vente)} offerts.`
        : `${fmtNumber(last.volume)} titres échangés${volMoyen != null ? `, pour ${fmtNumber(volMoyen)} en moyenne sur 20 séances` : ''}.`,
    });
  }
  if (gateSignaux.allowed && signal) {
    cartes.push({
      href: hrefRubrique('marche', fromDate, 'technique'),
      etiquette: 'Signal',
      titre: `Signal ${libelleSignal(signal.signal)}`,
      detail: `${signal.score_total != null ? `Score ${fr2(signal.score_total)} sur une échelle de −1 à +1` : 'Score non calculé'}${gateIndicateurs.allowed ? ` · ${lecture.soutient.length} élément${lecture.soutient.length > 1 ? 's' : ''} soutien${lecture.soutient.length > 1 ? 'nent' : 't'}, ${lecture.retient.length} reti${lecture.retient.length > 1 ? 'ennent' : 'ent'}` : ''}.`,
    });
  }
  if (gateFonda.allowed && economieSociete && economieSociete.resultatNet != null) {
    const rn = economieSociete.resultatNet;
    cartes.push({
      href: hrefRubrique('resultats', fromDate),
      etiquette: 'Résultats',
      titre: insecable(`Exercice ${economieSociete.exercice} : ${rn >= 0 ? 'bénéfice' : 'perte'} de ${fmtFcfa(Math.abs(rn))}`),
      detail: evolutionTexte ? insecable(`Résultat net sur un an : ${evolutionTexte}.`) : 'Évolution sur un an non disponible.',
    });
  }
  if (liquidity) {
    cartes.push({
      href: hrefRubrique('marche', fromDate, 'liquidite'),
      etiquette: 'Liquidité',
      titre: `Classe ${liquidity.classe} · ${liquidity.label}`,
      detail: insecable(`Échangé ${liquidity.presencePct} % des séances, ${fmtFcfa(liquidity.valeurMoyenne)} par séance en moyenne.`),
    });
  }

  // Chapitres de la barre collante (L'essentiel seulement s'il est rendu).

  const flottantPct = instrument?.flottant != null && shares != null && shares > 0 ? (instrument.flottant / shares) * 100 : null;
  const historiqueDiv = divRows.filter((d) => d.montant > 0).slice(0, 5);

  // ══ Vue d'ensemble ══════════════════════════════════════════════════════
  const aujourdhuiIso = new Date().toISOString().slice(0, 10);
  // Clôtures complètes pour 5A / Max : PostgREST tronque à 1000 lignes, on pagine.
  const historiqueComplet: { date_marche: string; cours_jour: number | null }[] = [];
  for (let page = 0; page < 20; page++) {
    const { data: lot } = await liqDailyClient
      .from('brvm_actions_daily')
      .select('date_marche, cours_jour')
      .eq('code', code)
      .gt('cours_jour', 0)
      .order('date_marche', { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    const l = (lot ?? []) as { date_marche: string; cours_jour: number | null }[];
    historiqueComplet.push(...l);
    if (l.length < 1000) break;
  }
  const seriesCours = seriesParPeriode(historiqueComplet);
  // 1J : graphique de séance s'il se trace, ou le constat « pas de transaction » ; sinon pas d'onglet 1J.
  const transactionsSeance = depuisPremiereTransaction(instantanes).length;
  const seanceTracable = transactionsSeance >= 2;
  const vueJourDisponible = instantanes.length > 0 && (seanceTracable || transactionsSeance === 0);

  // Profil de la société (0201) : public, sources officielles seulement.
  const { data: profilRow } = await createClient().from('societes_profils').select('presentation, historique, identite, metiers, determinants, dirigeants, actionnariat, site_web, verifie_le').eq('code', code).maybeSingle();
  const profil = normaliserProfil(profilRow);
  // Points clés tirés de NOS comptes et dividendes : verrouillés comme les fondamentaux.
  const pointsProfil = gateFonda.allowed ? pointsCles({
    famille: (instrument as { famille_comptable?: 'banque' | 'assurance' | 'general' | null } | null)?.famille_comptable ?? null,
    courant: exCourant,
    precedent: exPrecedent,
    dividendes: divRows.map((d) => ({ exercice: d.exercice, montant: d.montant })),
  }) : [];

  const [{ data: presseRows }, { data: prochainRow }] = await Promise.all([
    liqDailyClient
      .from('brvm_news')
      .select('id, titre, date_publication, source, source_label, source_url')
      .contains('ticker_codes', [code])
      .not('hidden', 'is', true) // modération rédactionnelle
      .lte('date_publication', aujourdhuiIso)
      .order('date_publication', { ascending: false })
      .limit(80),
    liqDailyClient
      .from('market_events')
      .select('title, event_date')
      .eq('instrument_code', code)
      .gt('event_date', aujourdhuiIso)
      .order('event_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  const groupesActus = regrouperActualites(
    publications.map((p) => ({ id: String(p.id), libelle: p.libelle, date_publication: p.date_publication, type_publication: p.type_publication, source_url: p.source_url })),
    (presseRows ?? []) as NewsEntree[],
    aujourdhuiIso,
  );
  const prochain = prochainRow as { title: string | null; event_date: string } | null;

  // Comptes : exercice retenu (source unique des ratios) et exercice précédent de la même série.
  const serieComptes = serieAnnuelle(financials?.incomeStatements ?? [], fundamentals);
  const exerciceVue = retenu.exercice;
  const comptesPrecedents = exerciceVue != null ? serieComptes.find((p) => p.exercice === exerciceVue - 1) ?? null : null;
  const nomSociete = instrument?.designation ?? last.designation ?? code;

  // ══ Note d'analyse (spec 2026-11-10 v2) ══════════════════════════════════
  const infoRubrique = RUBRIQUES.find((r) => r.id === rubrique) ?? RUBRIQUES[0];
  const fraicheurCpt = fraicheurComptes(exCourant?.year ?? null);
  const premierePhrase = (t: string | null) => (t ? t.split(/(?<=[.!?])s+/)[0] : null);
  // Calendrier : détachements et paiements annoncés, à partir d'aujourd'hui.
  const aVenir = divRows
    .filter((d) => d.montant > 0)
    .flatMap((d) => [
      ...(d.ex_date && d.ex_date >= aujourdhuiIso ? [{ type: 'Détachement' as const, date: d.ex_date, montant: d.montant }] : []),
      ...(d.payment_date && d.payment_date >= aujourdhuiIso ? [{ type: 'Paiement' as const, date: d.payment_date, montant: d.montant }] : []),
    ])
    .sort((a, b) => a.date.localeCompare(b.date));
  const lignesStats = lignesStatistiques({
    fondamentauxVisibles: gateFonda.allowed,
    capitalisation: capitalisationBrute,
    exercice: exerciceVue,
    chiffreAffaires: retenu.chiffreAffaires,
    chiffreAffairesPrecedent: comptesPrecedents?.chiffreAffaires ?? null,
    resultatNet: retenu.resultatNet,
    resultatNetPrecedent: comptesPrecedents?.resultatNet ?? null,
    bpa: retenu.source ? ratiosPublics.bpa : null,
    per: retenu.source ? ratiosPublics.per : null,
    titres: shares,
    rendementDividende: divYield != null ? { pct: divYield, exercice: divExercice, net: divDejaNet, ancien: divCourant?.ancien ?? false } : null,
    rendementNetIrvm: divYieldNet,
    dernierDividende: lastDiv ? { montant: lastDiv.montant, exercice: lastDiv.exercice, exDate: lastDiv.ex_date } : null,
    volume: last.volume ?? null,
    volumeMoyen20: volMoyen,
    valeurEchangee: last.valeur_echangee ?? null,
    transactions: last.nb_transactions ?? null,
    ouverture: last.ouverture ?? null,
    cloturePrecedente: last.cours_precedent ?? null,
    plusBas: last.plus_bas ?? null,
    plusHaut: last.plus_haut ?? null,
    plage52: plage52 ? { bas: plage52.bas, haut: plage52.haut } : null,
    beta: last.beta_1an ?? null,
    noteTechnique: gateSignaux.allowed ? noteAF(signal?.score_total ?? null, signal?.confiance ?? null) : null,
    combinedAlpha: combinedAlpha?.score ?? null,
    prochainEvenement: prochain?.title ? { titre: prochain.title, date: prochain.event_date } : null,
  });
  const notationVue = instrument?.notation_json
    ? { agence: instrument.notation_json.agence, note: instrument.notation_json.note, perspective: instrument.notation_json.perspective ?? null }
    : null;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-6 animate-rise-in">

      {/* ══════════════════════════════════════════════════
          BREADCRUMB + DOCUMENTS
      ══════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <nav className="flex items-center gap-2 text-xs text-faint">
          <Link
            href="/actions"
            className="hover:text-accent-ink transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          >
            Marché actions
          </Link>
          <span className="text-border-strong">›</span>
          <span className="text-muted">{code}</span>
        </nav>

        <div className="flex items-center gap-1.5 flex-wrap">
          <PublicationsModal
            code={code}
            designation={instrument?.designation}
            publications={publications}
            count={pubCount}
          />
          {/* Actions secondaires regroupées */}
          <ActionMenu code={code} />
        </div>
      </div>

      {/* ── Barre collante : chapitres + documents ── */}
      <FicheStickyNav
        code={code}
        cours={last.cours_jour}
        variationPct={last.variation_pct}
        up={up}
        actif={rubrique}
        from={fromDate}
        documents={[
          { href: `/actions/${code}/revue`, label: 'Revue de résultats' },
          { href: `/actions/${code}/financials`, label: 'États financiers' },
          { href: `/rapports/dossier/${code}`, label: 'Dossier A4' },
          { href: `/actions/${code}/quant`, label: 'Fiche Quant' },
        ]}
      />

      {/* ══════════════════════════════════════════════════
          EN-TÊTE — identité, cours, séance, plages, verdict
      ══════════════════════════════════════════════════ */}
      <header className="rounded-panel border border-border/60 bg-border/20 p-1.5">
        <div className="relative rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] overflow-hidden">
          <div
            className={`absolute inset-0 pointer-events-none ${
              up ? 'bg-emerald-veil' : '[background:radial-gradient(120%_60%_at_80%_-10%,rgba(226,75,75,0.06),transparent_55%)]'
            }`}
          />
          <div className="relative px-5 pt-5 pb-6 md:px-7 md:pt-7">
            <div className="min-w-0">
                {/* Logo + identité instrument */}
                <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {LOGOS[code] ? (
                      <div className="rounded-xl border border-border/60 bg-border/40 p-1 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={LOGOS[code]}
                          alt={code}
                          width={36}
                          height={36}
                          className="w-9 h-9 rounded-lg object-contain bg-white/90 p-0.5"
                        />
                      </div>
                    ) : (
                      <div className="w-11 h-11 rounded-xl border border-border/60 bg-elevated grid place-items-center shrink-0">
                        <span className="text-accent-ink text-sm font-display font-medium">{code.slice(0, 2)}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <h1 className="font-display text-xl md:text-2xl text-ivory tracking-tight leading-tight">
                        {code}
                      </h1>
                      <p className="text-xs text-muted truncate max-w-xs mt-0.5">
                        {instrument?.designation ?? last.designation ?? ''}
                      </p>
                    </div>
                  </div>

                  {/* Chips méta */}
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {pays && <StatPill tone="neutral">{pays}</StatPill>}
                    {secteur && <StatPill tone="sapphire">{secteur}</StatPill>}
                    {divYield != null && <StatPill tone="gold"><span className="whitespace-nowrap">Rdt {divYieldTexte(divYield)}</span></StatPill>}
                  </div>
                </div>

                {/* Prix principal */}
                <div className="flex flex-wrap items-end gap-x-4 gap-y-1 mb-1.5">
                  <span className="tabular font-mono text-4xl md:text-5xl font-bold tracking-tight text-ivory leading-none">
                    {fmtNumber(last.cours_jour)}
                  </span>
                  <span className="text-muted text-base mb-1">FCFA</span>
                  {varAbs != null && (
                    <span className={`tabular font-mono text-base font-semibold mb-1 ${up ? 'text-up' : 'text-down'}`}>
                      {up ? '+' : ''}{fmtNumber(varAbs)}{' '}
                      <span className="text-sm opacity-80">
                        ({pctFr(last.variation_pct ?? 0, 2, true)})
                      </span>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-[11px] text-faint">
                    Séance du <span className="text-muted">{fmtDateCourte(last.date_marche)}</span>
                  </p>
                  <FreshnessBadge fraicheur={fraicheur} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/portefeuille"
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs text-ivory transition hover:border-accent hover:text-accent-ink"
                  >
                    <Star size={14} strokeWidth={1.75} aria-hidden /> Suivre
                  </Link>
                  <Link
                    href="/parametres/alertes"
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs text-ivory transition hover:border-accent hover:text-accent-ink"
                  >
                    <BellPlus size={14} strokeWidth={1.75} aria-hidden /> Créer une alerte de prix
                  </Link>
                  <Link
                    href={`/actions/${code}/quant`}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-gold/30 bg-gold/[0.10] px-3.5 py-1.5 text-xs font-semibold text-accent-ink transition hover:bg-gold/15 hover:border-gold/40"
                  >
                    Fiche Quant · Combined Alpha
                  </Link>
                  <Link
                    href="/analyse/combined-alpha"
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs text-muted transition hover:border-gold/30 hover:text-accent-ink"
                  >
                    Classement complet →
                  </Link>
                </div>
            </div>

          </div>
        </div>
      </header>

      <div id="rubrique" className="scroll-mt-20 space-y-10">
      <ViewTracker event="fiche_rubrique_vue" properties={{ code, rubrique }} />
      <Chapitre premier id={`rubrique-${rubrique}`} titre={infoRubrique.label} sousTitre={infoRubrique.question} />

      {/* ══ SYNTHÈSE : que faut-il retenir, avec quel degré de confiance ? ══ */}
      {rubrique === 'synthese' && (<>
        <p className="-mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>Cours du <time dateTime={last.date_marche} className="text-ivory">{fmtDateCourte(last.date_marche)}</time></span>
          {fraicheurCpt && !fraicheurCpt.ancien && <span>Derniers comptes : exercice <span className="tabular text-ivory">{fraicheurCpt.exercice}</span></span>}
        </p>
        {fraicheurCpt?.ancien && <DonneeAbsente etat="ancien" date={`${fraicheurCpt.exercice}-12-31`} />}

        <SousSection id="cours" titre="Le cours">
          <div className="space-y-5">
            <StatsEtCours
              lignes={lignesStats}
              series={seriesCours}
              jour={vueJourDisponible ? <SeanceIntraday points={instantanes} /> : null}
              variationJour={last.variation_pct ?? null}
              periodeDefaut={seanceTracable ? '1J' : '1A'}
            />
            <JaugesPlage jour={plageJour} an={plage52} deuxAns={plage2ans} hausseDuJour={up} />
          </div>
        </SousSection>

        <SousSection id="lecture" titre="Ce que disent nos indicateurs" pied="Constats calculés sur les données en base, pas un conseil d’investissement.">
          <div className="space-y-4">
      {gateSignaux.allowed ? (
        <VerdictBand
          note={noteAF(signal?.score_total ?? null, signal?.confiance ?? null)}
          signal={signal?.signal ?? null}
          scoreTotal={signal?.score_total ?? null}
          confiance={signal?.confiance ?? null}
          sparkData={sparkData}
          up={up}
          cours={last.cours_jour}
          low52={plage2ans?.bas ?? null}
          high52={plage2ans?.haut ?? null}
          synthesisLine={verdictLine}
          libelleNote={scoreToRating(signal?.score_total ?? null, signal?.confiance ?? null).note === 'NR' ? null : scoreToRating(signal?.score_total ?? null, signal?.confiance ?? null).label}
        />
      ) : (
        <VerdictBand
          note={null}
          signal={null}
          scoreTotal={null}
          confiance={null}
          sparkData={sparkData}
          up={up}
          cours={last.cours_jour}
          low52={plage2ans?.bas ?? null}
          high52={plage2ans?.haut ?? null}
          synthesisLine={null}
        />
      )}
      {instrument?.notation_json && (
        <NotationBadge
          notation={instrument.notation_json}
          notationPubs={publications.filter((p) => p.type_publication === 'notation')}
        />
      )}
        <CombinedAlphaCarte
          code={code}
          score={combinedAlpha?.score ?? null}
          rang={combinedAlpha?.rang ?? null}
          piliers={combinedAlpha?.piliers ?? []}
          penalite={combinedAlpha?.penalite ?? null}
          penaliteAppliquee={decompositionCA?.penalite ?? null}
          resumePenalite={combinedAlphaRow && Array.isArray(combinedAlphaRow.penalties_json)
            ? resumeGardeFous(chaineGardeFous(combinedAlphaRow.penalties_json as { code: string; points: number }[], decompositionCA))
            : null}
          calculeLe={combinedAlpha?.calculeLe ?? null}
          derniereSeance={last.date_marche}
        />
          </div>
        </SousSection>

        <SousSection id="essentiel" titre="L’essentiel">
          <Essentiel cartes={cartes} />
        </SousSection>

        <SousSection id="analyse-ia" titre="Analyse par IA">
          <AnalyseIA code={code} nom={instrument?.designation ?? null} exerciceComptes={economieSociete?.exercice ?? null} />
        </SousSection>

        <SousSection id="plus-loin" titre="Pour aller plus loin">
          <ul className="grid gap-3 md:grid-cols-2">
            <li>
              <Link href={hrefRubrique('societe', fromDate)} className="block h-full rounded-card border border-border bg-surface p-4 transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <span className="text-sm font-medium text-ivory">Ce que fait {nomSociete}</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-muted">{premierePhrase(profil?.presentation ?? null) ?? 'Présentation, direction et actionnariat.'}</span>
              </Link>
            </li>
            <li>
              <Link href={hrefRubrique('resultats', fromDate)} className="block h-full rounded-card border border-border bg-surface p-4 transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <span className="text-sm font-medium text-ivory">Ses comptes</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-muted">{(gateFonda.allowed ? phrasePerformance({
            nom: nomSociete,
            exercice: exerciceVue,
            chiffreAffaires: retenu.chiffreAffaires,
            chiffreAffairesPrecedent: comptesPrecedents?.chiffreAffaires ?? null,
            resultatNet: retenu.resultatNet,
            resultatNetPrecedent: comptesPrecedents?.resultatNet ?? null,
          }) : null) ?? 'Comptes publiés et leur évolution.'}</span>
              </Link>
            </li>
          </ul>
        </SousSection>
      </>)}

      {/* ══ SOCIÉTÉ : que fait-elle et qui la contrôle ? ══ */}
      {rubrique === 'societe' && (<>
        {profil?.presentation && <SousSection id="presentation" titre="Présentation"><ProfilPresentation profil={profil} /></SousSection>}
        {profil?.historique && <SousSection id="historique" titre="Historique"><ProfilHistorique profil={profil} /></SousSection>}
        {profil && profil.metiers.length > 0 && <SousSection id="metiers" titre="Métiers"><ProfilListe items={profil.metiers} ton="fort" /></SousSection>}
        {profil && profil.determinants.length > 0 && <SousSection id="determinants" titre="Ce qui fait varier l’activité"><ProfilListe items={profil.determinants} ton="doux" /></SousSection>}
        <SousSection id="direction" titre="Direction"><ProfilDirection profil={profil} /></SousSection>
        <SousSection id="actionnariat" titre="Actionnariat"><ProfilActionnariat profil={profil} /></SousSection>
        <SousSection id="identite" titre="Identité">
          <div className="grid gap-6 rounded-card border border-border bg-surface p-4 lg:grid-cols-2">
            <ProfilIdentite profil={profil} />
            <AProposBloc a={{
          nom: nomSociete,
          code,
          secteur,
          pays: pays ? (/^[A-Za-z]{2}$/.test(pays) ? nomPays(pays) : pays) : null,
          famille: libelleFamille((instrument as { famille_comptable?: string | null } | null)?.famille_comptable ?? null),
          titres: shares,
          flottant: instrument?.flottant ?? null,
          flottantPct,
          notation: notationVue,
          historiqueDepuis: dateEnLettres(historiqueComplet[0]?.date_marche ?? null),
            }} />
          </div>
        </SousSection>
        <NoteSources profil={profil} />
      </>)}

      {/* ══ RÉSULTATS : gagne-t-elle de l'argent, et de mieux en mieux ? ══ */}
      {rubrique === 'resultats' && (<>
        {gateFonda.allowed && exCourant?.net_income != null && exCourant.net_income < 0 && (
          <div role="note" className="rounded-card border border-down/30 bg-down/5 px-5 py-4">
            <p className="text-sm text-ivory">
              {insecable(`Exercice ${exCourant.year} en perte : résultat net de −${fmtFcfa(Math.abs(exCourant.net_income))} FCFA.`)}
            </p>
            <p className="mt-1 text-xs text-muted">Le PER n&apos;est pas calculable et le taux de distribution est sans objet tant que le résultat est négatif.</p>
          </div>
        )}
        {pointsProfil.length > 0 && <SousSection id="points-cles" titre="Points clés"><PointsCles points={pointsProfil} /></SousSection>}
        {fundamentals.length > 0 ? (
          <SousSection id="comptes" titre="Comptes publiés">
        {fundamentals.length > 0 && (() => {
          const latest = pickBestFundamental(fundamentals)!;
          const range52 = { low: plage52?.bas ?? null, high: plage52?.haut ?? null, current: last.cours_jour ?? null };
          // Verrou premium : on ne rend PAS le panneau (donc aucune donnée dans le HTML).
          if (!gateFonda.allowed) {
            return (
              <div id="fondamentaux" className="scroll-mt-24">
                <SectionLock
                  required={gateFonda.required === 'free' ? 'premium' : gateFonda.required}
                  titre="Analyse fondamentale"
                  suivi={{ code, rubrique: 'resultats' }}
                  pitch="PER, P/B, ROE, marge, endettement, et leur lecture."
                />
              </div>
            );
          }

          return (
            <div id="fondamentaux" className="scroll-mt-24">
              <FundamentalsPanel
                canEdit={canEditFondamentaux}
                code={code}
                year={retenu.exercice ?? latest.year}
                ratiosPublics={retenu.source ? ratiosPublics : undefined}
                comptesRetenus={retenu.source ? { chiffreAffaires: retenu.chiffreAffaires, resultatNet: retenu.resultatNet, capitauxPropres: retenu.capitauxPropres, detteFinanciere: retenu.detteFinanciere } : undefined}
                mentionSecondJeu={mentionJeu}
                inputs={{
                  cours: last.cours_jour ?? null,
                  shares: instrument?.shares ?? null,
                  revenue: latest.revenue,
                  net_income: latest.net_income,
                  equity: latest.equity,
                  debt: latest.debt,
                  dividende: lastDiv?.montant ?? null,
                }}
                sharesSource={instrument?.shares_source ?? null}
                isManual={latest.is_manual ?? false}
                history={(() => {
                  // Un point par exercice (le corrigé manuellement l'emporte), sans
                  // filtrer par is_manual : sinon une seule ligne corrigée vidait
                  // l'historique et la croissance devenait « non disponible ».
                  const byYear = new Map<number, { year: number; revenue: number | null; net_income: number | null }>();
                  for (const f of [...fundamentals].sort((a, b) => (a.is_manual ? 1 : 0) - (b.is_manual ? 1 : 0))) {
                    if (f.year != null) byYear.set(f.year, { year: f.year, revenue: f.revenue, net_income: f.net_income });
                  }
                  return [...byYear.values()];
                })()}
                sourceUrl={null}
                range52={range52}
                resultatNet={(retenu.source ? retenu.resultatNet : latest.net_income) ?? null}
                famille={(instrument as { famille_comptable?: 'banque' | 'assurance' | 'general' | null } | null)?.famille_comptable ?? null}
                dividendeExercice={divCourant?.exercice ?? null}
                dividendeVerifie={divCourant?.ex_date != null}
                sansPlage52
                sansAlertePerte
              />
              {comparatifIfrs && <ComptesIfrs c={comparatifIfrs} />}

              {/* Constructeur de graphique replié sous le graphique CA / résultat net */}
              {chartRows.length >= 2 && (
                <details className="mt-4 rounded-card border border-border bg-surface p-4">
                  <summary className="cursor-pointer text-sm text-ivory">Personnaliser ce graphique</summary>
                  <div className="mt-4">
                    <ChartBuilder rows={chartRows} />
                  </div>
                </details>
              )}
            </div>
          );
        })()}
          </SousSection>
        ) : (
          <SousSection id="comptes" titre="Comptes publiés"><DonneeAbsente etat="non_collecte" /></SousSection>
        )}
        {gateFonda.allowed && exCourant && (detailExercice.length > 0 || evolutionTexte) && (
          <div id="exercice" className="scroll-mt-24 rounded-card border border-border bg-surface p-5">
            <h3 className="text-lg font-medium text-ivory">L&apos;exercice {exCourant.year} en détail</h3>
            {phraseExercice && <p className="mt-1 text-[13px] text-muted">{phraseExercice}</p>}
            <dl className="mt-4 divide-y divide-border/40">
              {detailExercice.map((l) => (
                <div key={l.label} className="flex items-center justify-between py-2 text-xs">
                  <dt className="text-muted">{l.label}</dt>
                  <dd className={`tabular font-mono ${(l.valeur as number) < 0 ? 'text-down' : 'text-ivory'}`}>
                    {(l.valeur as number) < 0 ? '−' : ''}{insecable(`${fmtFcfa(Math.abs(l.valeur as number))} FCFA`)}
                  </dd>
                </div>
              ))}
              {evolutionTexte && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-xs">
                  <dt className="text-muted">Évolution du résultat net{exPrecedent?.year != null ? ` (vs ${exPrecedent.year})` : ''}</dt>
                  <dd className="text-ivory">{insecable(evolutionTexte)}</dd>
                </div>
              )}
            </dl>
            {horsExpl != null && (
              <p className="mt-3 text-[11px] text-faint">Hors exploitation = résultat avant impôt − résultat d&apos;exploitation.</p>
            )}
          </div>
        )}
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <Link href={`/actions/${code}/revue`} className="rounded text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Revue de résultats</Link>
          <Link href={`/actions/${code}/financials`} className="rounded text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">États financiers complets</Link>
        </p>
      </>)}

      {/* ══ VALORISATION ET DIVIDENDES : est-ce cher, et que me verse-t-elle ? ══ */}
      {rubrique === 'valorisation' && (<>
        <SousSection id="multiples" titre="Multiples de valorisation">
        {valuation && valuation.metrics.reliable ? (
          <div id="valorisation" className="scroll-mt-24">
            {gateValo.allowed ? (
              <ValuationPanel v={valuation} scoring={scoring} rendementDividende={{ pct: divYield, exercice: divCourant?.exercice ?? null }} masquerRationale />
            ) : (
              <SectionLock
                required={gateValo.required === 'free' ? 'premium' : gateValo.required}
                titre="Valorisation"
                suivi={{ code, rubrique: 'valorisation' }}
                pitch="Le titre est-il cher ou bon marché ? Multiples et valeur intrinsèque."
              />
            )}
          </div>
        ) : (
          <DonneeAbsente etat="non_collecte" />
        )}
        </SousSection>
        <SousSection id="dividendes" titre="Dividendes">
          <div className="rounded-card border border-border bg-surface p-5">
                {lastDiv && divCourant ? (
                  <div>
                    {divYield != null && (
                      <div className="mb-4 flex flex-wrap items-baseline gap-2">
                        <span className="tabular font-mono text-3xl font-bold text-ivory leading-none whitespace-nowrap">
                          {rendementDividendeParts(divYield, divExercice)?.valeur}
                        </span>
                        <span className="text-xs text-muted">
                          {divDejaNet ? "rendement estimé, net d'IRVM" : lastDiv?.base_fiscale === 'brut' ? 'rendement estimé, brut' : 'rendement estimé, montant tel que publié'}
                          {divExercice != null && <span className="block text-faint">ex. {divExercice}</span>}
                        </span>
                      </div>
                    )}
                    {divCourant.ancien && (
                      <p className="mb-3 text-[11px] text-warn">
                        Dividende de l&apos;exercice {divCourant.exercice}, antérieur de plus d&apos;un an au dernier exercice publié ({exCourant?.year}) : ce rendement n&apos;est pas un point d&apos;appui.
                      </p>
                    )}
                    <div className="space-y-0 border-t border-border/30 pt-3">
                      <DivRow label="Dernier versement" value={fmtNumber(lastDiv.montant) + ' FCFA'} />
                      {divCourant.exercice != null && <DivRow label="Exercice" value={String(divCourant.exercice)} />}
                      <DivRow label="Détachement" value={fmtDateCourte(lastDiv.ex_date)} />
                      {lastDiv.payment_date && <DivRow label="Paiement" value={fmtDateCourte(lastDiv.payment_date)} />}
                    </div>
                    {historiqueDiv.length > 1 && (
                      <div className="mt-4">
                        <p className="text-[11px] text-faint mb-2">Historique ({historiqueDiv.length} derniers exercices)</p>
                        <div className="space-y-0">
                          {historiqueDiv.map((d, i) => (
                            <DivRow
                              key={`${i}-${d.exercice}`}
                              label={d.exercice != null ? `Exercice ${d.exercice}` : 'Exercice non renseigné'}
                              value={`${fmtNumber(d.montant)} FCFA${d.ex_date ? ` · ${fmtDateCourte(d.ex_date)}` : ''}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-[11px] text-faint mt-3">Rendement calculé sur le cours actuel</p>
                  </div>
                ) : (
                  <p className="text-xs text-faint italic">Aucun dividende enregistré.</p>
                )}
          </div>
        </SousSection>
      </>)}

      {/* ══ COURS ET LIQUIDITÉ : puis-je acheter et revendre, à quel coût ? ══ */}
      {rubrique === 'marche' && (<>
        {rows.length < 20 && (
          <div className="border border-warn/20 bg-warn/5 rounded-card px-5 py-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="text-warn text-base leading-none">!</span>
              <p className="text-xs text-warn font-medium">
                Données insuffisantes — {rows.length} séance{rows.length > 1 ? 's' : ''} sur 20 requises pour RSI, MACD et moyennes mobiles.
              </p>
            </div>
            <p className="text-xs text-faint">
              L&apos;historique s&apos;étoffe automatiquement séance après séance ; les indicateurs
              s&apos;activeront dès que la profondeur sera suffisante.
            </p>
          </div>
        )}
        <SousSection id="cours" titre="Cours et volume">
          <div>
          <PremiumPanel className="p-0 overflow-hidden">
            <div className="px-4 py-4 md:px-5">
              <PriceChart
                data={priceData}
                designation={instrument?.designation ?? last.designation ?? code}
                markers={chartMarkers}
              />
            </div>
          </PremiumPanel>
          <div className="mt-2">
            <EventMarkerLegend markers={chartMarkers} />
          </div>
          </div>
        </SousSection>
        <SousSection id="liquidite" titre="Liquidité et coût d’exécution">
          <LiquidityCard liquidity={liquidity} courtageMin={courtageMin} courtageMax={courtageMax} />
        </SousSection>
        <SousSection id="carnet" titre="Carnet d’ordres">
          <CarnetOrdres carnet={carnet} />
        </SousSection>
        <SousSection id="seance" titre={`La séance du ${fmtDateCourte(last.date_marche)}`}>
        {gateLectureSeance.allowed ? (
          <CarnetCommentaire
            replie
            carnet={carnet}
            signal={signal ? {
              date_marche: signal.date_marche,
              signal: signal.signal,
              confiance: signal.confiance ?? null,
              score_total: signal.score_total ?? null,
              explication: signal.explication ?? null,
              // Les sous-scores : seule base permettant de dire que les facteurs
              // se contredisent. Sans eux, le texte ne l'affirme pas.
              sousScores: (() => {
                const s = signal as unknown as Record<string, unknown>;
                const n = (k: string) => (typeof s[k] === 'number' ? (s[k] as number) : null);
                return { variation: n('score_variation'), volume: n('score_volume'), rsi: n('score_rsi'), macd: n('score_macd'), tendance: n('bonus_tendance') };
              })(),
            } : null}
            actualites={actualites}
            contexte={contexteCarnet}
            bruit={bruitSeance}
            economie={economieSociete}
            evenements={mesuresEvenements}
          />
        ) : (
          // Verrou premium : le composant n'est pas rendu, aucun chiffre du
          // commentaire n'atteint le HTML pour un visiteur non autorisé.
          <SectionLock
            required={gateLectureSeance.required === 'free' ? 'premium' : gateLectureSeance.required}
            titre="Ce que dit la séance"
            suivi={{ code, rubrique: 'marche' }}
            pitch="Le carnet d'ordres rapporté aux capitaux échangés, la fourchette chiffrée en francs et comparée au reste du marché, le score technique face à ses seuils, et les comptes rapportés au cours."
          />
        )}
        </SousSection>
        <SousSection id="technique" titre="Lecture technique">
          {gateIndicateurs.allowed ? (
          <LectureTechnique
            lecture={lecture}
            signal={gateSignaux.allowed ? signal?.signal ?? null : null}
            score={gateSignaux.allowed ? signal?.score_total ?? null : null}
            qualiteDonnees={gateSignaux.allowed ? signal?.confiance ?? null : null}
            graphiques={
              <div className="space-y-4">
                <IndicateursActuels
                  rsi={lastRsi ?? null}
                  cours={last.cours_jour ?? null}
                  moyennes={[
                    { label: 'MA 20', val: lastMa20 },
                    { label: 'MA 50', val: lastMa50 },
                    { label: 'MA 200', val: lastMa200 },
                  ]}
                  macd={lastMacd ?? null}
                />
                <IndicatorCharts data={indicatorData} />
              </div>
            }
            synthese={{
              haussiers: technicalSummary.bullCount,
              neutres: technicalSummary.neutCount,
              baissiers: technicalSummary.bearCount,
              indicateurs: technicalSummary.signals.map((s) => ({ texte: s.detail, sens: s.direction })),
            }}
            saisonnalite={
              seasonalityReturns.length > 0
                ? <SeasonalityCard code={code} returns={seasonalityReturns} />
                : <p className="text-[13px] text-muted">Saisonnalité non disponible pour cette valeur.</p>
            }
            detections={detections}
            position={
              !gateSignaux.allowed ? (
                <p>La lecture de votre position selon le signal est réservée aux abonnés.</p>
              ) : analyseSignal ? (
                <PositionLecture ctx={analyseSignal.positionCtx} />
              ) : (
                <p>Aucun signal calculé pour la dernière séance scorée.</p>
              )
            }
            detailScore={blocSignal}
          />
          ) : (
            <div className="space-y-6">
            <SectionLock
              required={gateIndicateurs.required === 'free' ? 'premium' : gateIndicateurs.required}
              titre="Lecture technique"
              suivi={{ code, rubrique: 'marche' }}
              pitch="RSI, MACD, moyennes mobiles, bandes de Bollinger, détections de configurations et lecture commentée."
            />
              <div>
                <h4 className="mb-3 text-sm font-medium text-ivory">Signal quantitatif</h4>
                {blocSignal}
              </div>
            </div>
          )}
        </SousSection>
        {!gateIndicateurs.allowed && (
          <SousSection id="saisonnalite" titre="Saisonnalité">
            <SeasonalityCard code={code} returns={seasonalityReturns} />
          </SousSection>
        )}
      </>)}

      {/* ══ ACTUALITÉS ET CALENDRIER : qu'est-ce qui a changé, qu'est-ce qui arrive ? ══ */}
      {rubrique === 'actualites' && (<>
        <SousSection id="calendrier" titre="Calendrier">
          {aVenir.length > 0 ? (
            <ul className="divide-y divide-border/50 rounded-card border border-border bg-surface px-4">
              {aVenir.map((e) => (
                <li key={e.type + e.date} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm">
                  <span className="text-ivory">{e.type} du dividende</span>
                  <span className="text-muted"><time dateTime={e.date} className="tabular text-ivory">{fmtDateCourte(e.date)}</time>, {fmtNumber(e.montant)} FCFA par action</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Aucune date annoncée.</p>
          )}
        </SousSection>
        <SousSection id="evenements" titre="Événements récents">
          <div className="rounded-card border border-border bg-surface p-5">
                {events.length > 0 ? (
                  <div className="space-y-3.5">
                    {(events as { id: string; title: string; event_date: string; event_type: string; sentiment?: string }[]).map((e) => (
                      <div key={e.id} className="border-b border-border/30 pb-3.5 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] text-faint">{fmtDateCourte(e.event_date)}</span>
                          <span className="text-[11px] border border-border/60 rounded-full px-2 py-px text-faint">
                            {libelleEvenement(e.event_type)}
                          </span>
                        </div>
                        <p className="text-xs text-muted line-clamp-2 mb-1.5">{e.title}</p>
                        <Link
                          href={`/dashboard/reports/events/${e.id}`}
                          className="text-[11px] text-accent-ink hover:text-accent-ink transition-colors duration-300"
                        >
                          Lire l&apos;analyse →
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-faint italic">Aucun événement récent.</p>
                )}
          </div>
        </SousSection>
        <ActualitesValeur groupes={groupesActus} nom={nomSociete} />
      </>)}

      {/* ══ MON SUIVI : où en est ma propre thèse ? ══ */}
      {rubrique === 'suivi' && (<>
        <SousSection id="these" titre="Ma thèse">
          <ThesisPanel code={code} coursActuel={last.cours_jour ?? null} />
        </SousSection>
        <SousSection id="outils" titre="Mes outils">
          <div className="rounded-panel border border-border/60 bg-border/20 p-1.5">
            <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {[
                  { href: `/api/export/actions/${code}`, label: 'Exporter CSV', icon: Download, external: true },
                  { href: `/backtest?code=${code}`, label: 'Lancer un backtest', icon: History },
                  { href: `/actions/${code}/rapport`, label: 'Rapport PDF analyste', icon: FileText, external: true },
                  { href: `/assistant?symbole=${code}`, label: 'Analyser cette valeur', icon: MessageSquareText },
                ].map(({ href, label, icon: Icone, external }) => {
                  const cls =
                    'group flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-xs text-muted hover:border-gold/30 hover:text-ivory hover:bg-gold/[0.03] transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';
                  const inner = (
                    <>
                      <span className="text-accent-ink group-hover:text-accent-ink transition-colors duration-300 leading-none shrink-0">
                        <Icone size={15} strokeWidth={1.75} aria-hidden />
                      </span>
                      <span>{label}</span>
                      <span className="ml-auto text-border-strong group-hover:text-accent-ink transition-colors duration-300">→</span>
                    </>
                  );
                  return external ? (
                    <a key={label} href={href} className={cls}>{inner}</a>
                  ) : (
                    <Link key={label} href={href} className={cls}>{inner}</Link>
                  );
                })}
              </div>
            </div>
          </div>
        </SousSection>
        <SousSection id="discussions" titre="Discussions sur le titre" action={<Link href="/forum/nouveau" className="rounded text-sm text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Démarrer une discussion</Link>}>
          <ForumTopicList topics={forumTopics} authors={forumAuthors} />
        </SousSection>
      </>)}

      </div>
    </div>
  );
}

/** Valeurs actuelles des indicateurs (RSI, moyennes mobiles, MACD), reprises de l'ancienne « Analyse technique ». */
function IndicateursActuels({
  rsi,
  cours,
  moyennes,
  macd,
}: {
  rsi: number | null;
  cours: number | null;
  moyennes: { label: string; val: number | null }[];
  macd: { macd: number | null; signal: number | null; hist: number | null } | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="rounded-card border border-border p-4">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-muted">RSI (14)</span>
          <span className={`tabular font-semibold font-mono ${rsi == null ? 'text-faint' : rsi < 30 ? 'text-up' : rsi > 70 ? 'text-down' : 'text-ivory'}`}>
            {nombreFr(rsi, 0)}
          </span>
        </div>
        <div className="relative h-1.5 rounded-full overflow-hidden bg-border">
          <div className="absolute left-0 top-0 bottom-0 w-[30%] rounded-l-full bg-gradient-to-r from-up/35 to-up/[0.08]" />
          <div className="absolute right-0 top-0 bottom-0 w-[30%] rounded-r-full bg-gradient-to-l from-down/35 to-down/[0.08]" />
          {rsi != null && <RsiCursor rsi={rsi} />}
        </div>
        <div className="flex justify-between text-[11px] text-faint mt-1.5">
          <span>Survente &lt;30</span>
          <span>Équilibre</span>
          <span>Surachat &gt;70</span>
        </div>
        <BeginnerHint text="RSI sous 30 : le titre a fortement reculé en peu de séances (zone dite de survente). RSI au-dessus de 70 : il a fortement progressé (zone dite de surachat). Ni l'un ni l'autre ne prédit le mouvement suivant." />
      </div>

      <div className="rounded-card border border-border p-4">
        <p className="text-[11px] text-faint mb-3">Moyennes mobiles</p>
        <div className="space-y-2">
          {moyennes.map(({ label, val }) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="text-muted">{label}</span>
              <div className="flex items-center gap-2">
                <span className="tabular font-mono text-ivory">{val != null ? fmtNumber(val) : '—'}</span>
                {val != null && cours != null && (
                  <span className={`text-[11px] ${cours >= val ? 'text-up' : 'text-down'}`}>{cours >= val ? '↑' : '↓'}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-card border border-border p-4">
        <p className="text-[11px] text-faint mb-3">MACD</p>
        {macd ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              <MacdCell label="Ligne" value={nombreFr(macd.macd, 0)} />
              <MacdCell label="Signal" value={nombreFr(macd.signal, 0)} />
              <MacdCell
                label="Histog."
                value={macd.hist != null && macd.hist >= 0 ? '+' + nombreFr(macd.hist, 0) : nombreFr(macd.hist, 0)}
                accent={(macd.hist ?? 0) >= 0 ? 'up' : 'down'}
              />
            </div>
            <BeginnerHint text="MACD positif = tendance haussière. MACD négatif = tendance baissière." />
          </>
        ) : (
          <p className="text-xs text-faint">Historique insuffisant pour le MACD.</p>
        )}
      </div>
    </div>
  );
}

/** Position de l'utilisateur lue selon le signal (PRU, plus-value latente) — reprise de SignalAnalysis. */
function PositionLecture({ ctx }: { ctx: { held: boolean; pru: number | null; latentPnlPct: number | null; reading: string } }) {
  return (
    <div className="space-y-1">
      {ctx.held && (
        <>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted">Plus-value latente</span>
            <span className={`tabular text-sm font-semibold ${(ctx.latentPnlPct ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>
              {pctFr(ctx.latentPnlPct, 1, true)}
            </span>
          </div>
          {ctx.pru != null && (
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted">PRU</span>
              <span className="tabular text-xs text-ivory">{ctx.pru.toLocaleString('fr-FR')} FCFA</span>
            </div>
          )}
        </>
      )}
      <p className="text-xs text-muted leading-relaxed">{ctx.reading}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS
// ══════════════════════════════════════════════════════════════════

/** Cellule MACD */
function MacdCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'up' | 'down';
}) {
  return (
    <div className="bg-elevated rounded-lg py-2.5 px-2">
      <div className="text-muted text-[11px] mb-1">{label}</div>
      <div
        className={`tabular font-mono text-sm font-semibold ${
          accent === 'up' ? 'text-up' : accent === 'down' ? 'text-down' : 'text-ivory'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/** Ligne dividende */
function DivRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="tabular font-mono text-xs text-ivory">{value}</span>
    </div>
  );
}

/** Panel signal du jour — premium */
function SignalPanel({ signal }: { signal: SignalDaily }) {
  const subScores = (signal as SignalDaily & { inputs?: Record<string, number> | null }).inputs ?? null;

  return (
    <div className="rounded-panel border border-border/60 bg-border/20 p-1.5">
      <div
        className={`rounded-[calc(1.125rem-0.375rem)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-5 md:p-6 overflow-hidden relative ${
          signal.signal === 'BUY'
            ? 'bg-[linear-gradient(135deg,rgba(22,180,106,0.04)_0%,#0e1014_40%)]'
            : signal.signal === 'SELL'
            ? 'bg-[linear-gradient(135deg,rgba(226,75,75,0.04)_0%,#0e1014_40%)]'
            : 'bg-surface'
        }`}
      >
        {/* Header signal */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <p className="text-[11px] text-accent-ink">Signal quantitatif</p>
          <SignalBadge signal={signal.signal} confiance={signal.confiance} />
          <RatingBadge scoreTotal={signal.score_total} confiance={signal.confiance} />
          <span className="ml-auto tabular text-[11px] text-faint font-mono">
            {signal.score_total != null
              ? (signal.score_total >= 0 ? '+' : '') + nombreFr(signal.score_total, 2)
              : '—'}
            {' / 1,00 · dernière séance scorée '}{fmtDateCourte(signal.date_marche)}
          </span>
        </div>

        <BeginnerHint text="Score > 60 = signal favorable. Score < 40 = signal défavorable. Entre les deux = neutre." />

        <p className="text-sm text-muted mb-5 leading-relaxed">
          {signal.explication ?? 'Signal calculé à partir des indicateurs de la séance.'}
        </p>

        {/* Sous-scores */}
        {(() => {
          const subScoreRows = [
            { label: 'variation_norm', val: signal.score_variation },
            { label: 'volume_signal', val: signal.score_volume },
            { label: 'rsi_signal', val: signal.score_rsi },
            { label: 'bonus_tendance', val: signal.bonus_tendance },
            { label: 'penalite_liquidite', val: signal.penalite_liquidite != null ? -signal.penalite_liquidite : null },
          ].filter((r) => r.val != null);

          if (subScoreRows.length === 0) return null;
          return (
            <div className="border-t border-border/30 pt-4 mb-4">
              <p className="text-[11px] text-faint mb-3">Sous-scores</p>
              <div className="space-y-2">
                {subScoreRows.map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-muted font-mono">{label}</span>
                    <span
                      className={`tabular font-mono font-semibold ${
                        (val as number) >= 0 ? 'text-up' : 'text-down'
                      }`}
                    >
                      {(val as number) >= 0 ? '+' : ''}{nombreFr(val as number, 2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {subScores && (() => {
          const entries = Object.entries(subScores).filter(([, v]) => v != null);
          if (entries.length === 0) return null;
          return (
            <div className="border-t border-border/30 pt-4 mb-4">
              <p className="text-[11px] text-faint mb-3">Indicateurs utilisés</p>
              <div className="space-y-2">
                {entries.slice(0, 6).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <span className="text-muted font-mono">{k}</span>
                    <span className="tabular font-mono text-faint">
                      {typeof v === 'number' ? nombreFr(v, 3) : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="border-t border-border/30 pt-4 flex items-center justify-between">
          <Link
            href="/signaux"
            className="text-xs text-accent-ink hover:text-accent-ink transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          >
            Voir tous les signaux →
          </Link>
        </div>
      </div>
    </div>
  );
}
