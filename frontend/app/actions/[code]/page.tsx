import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
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
import IndicatorCommentary from '@/components/IndicatorCommentary';
import { readIndicators } from '@/lib/indicators/commentary';
import RsiCursor from '@/components/RsiCursor';
import SignalBadge from '@/components/SignalBadge';
import RatingBadge from '@/components/RatingBadge';
import { VerdictBand } from '@/components/actions/VerdictBand';
import { FicheStickyNav } from '@/components/actions/FicheStickyNav';
import PublicationsModal, { type Publication } from '@/components/PublicationsModal';
import FundamentalsPanel from '@/components/fundamentals/FundamentalsPanel';
import { BeginnerHint } from '@/components/BeginnerHint';
import { pickBestFundamental } from '@/lib/fundamentals';
import { computeLiquidity, fromDailyRow, type LiquidityDailyRow } from '@/lib/liquidity';
import { LiquidityCard } from '@/components/LiquidityCard';
import { getSgiFrais } from '@/lib/sgi-frais/queries';
import { fmtNumber, fmtFcfa } from '@/lib/format';
import { smaSeries, rsiSeries, macdSeries, bollingerSeries, detect, stochasticSeries, cciSeries } from '@/lib/indicators';
import { computeTechnicalSummary } from '@/lib/technicalSummary';
import type { TechnicalSummaryResult } from '@/lib/technicalSummary';
import TechnicalSummary from '@/components/TechnicalSummary';
import NotationBadge from '@/components/NotationBadge';
import SignalAnalysis from '@/components/SignalAnalysis';
import ValuationPanel from '@/components/ValuationPanel';
import { getValuation } from '@/lib/valuation/server';
import { getScoring } from '@/lib/scoring/server';
import { listTopics } from '@/lib/forum/server';
import { ForumTopicList } from '@/components/forum/ForumTopicList';
import { readTechnical } from '@/lib/signal/technical';
import { analyzeDividendTiming } from '@/lib/signal/dividendTiming';
import { rendementNet } from '@/lib/tax/compute';
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
  Eyebrow,
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
    title: `${nom} (${code}) — cours, dividendes et analyse BRVM`,
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
      title: `${nom} (${code}) — cours BRVM`,
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
        .select('montant, ex_date, payment_date, exercice')
        .eq('code', code)
        // Tri par exercice (toujours renseigné). Trier par ex_date mettait les
        // NULL en tête (PostgREST) et pouvait évincer les lignes datées du limit.
        .order('exercice', { ascending: false })
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
        .limit(50),
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
  searchParams: { from?: string };
}) {
  const code = decodeURIComponent(params.code).toUpperCase();

  // Indicateurs techniques (RSI, MACD, moyennes mobiles, lecture, explication IA).
  // Niveau requis LU EN BASE (feature_flags → `indicateurs_techniques`), éditable
  // dans /admin/features. Le cours et le volume, eux, restent publics.
  const [gateIndicateurs, gateSignaux, gateFonda, gateValo] = await Promise.all([
    canAccess('indicateurs_techniques'), // verdict, config technique, RSI/MACD
    canAccess('signaux'),                // signal quantitatif
    canAccess('fondamentaux'),           // analyse fondamentale
    canAccess('dcf'),                    // valorisation
  ]);

  // États financiers complets pour le constructeur de graphique — chargés
  // seulement si l'accès fondamental est ouvert (aucun coût pour les anonymes,
  // qui ne verraient qu'un cadenas de toute façon).
  const chartRows = gateFonda.allowed
    ? await loadCompanyFinancials(code).then((f) =>
        f ? buildChartRows(f.incomeStatements, f.balanceSheets, f.cashFlowStatements) : [],
      )
    : [];
  const fromDate = searchParams.from ?? '';
  const { rows, instrument, signal, dividends, events, publications, pubCount, fundamentals, position } = await getData(code, fromDate || undefined);
  const [valuation, scoring] = await Promise.all([
    getValuation(code).catch(() => null),
    getScoring(code).catch(() => null),
  ]);
  const { topics: forumTopics, authors: forumAuthors } = await listTopics(0, code);

  if (rows.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <Link
          href="/actions"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-gold transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
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

  // Rendement dividende
  // Priorité au dividende VÉRIFIÉ (détachement daté). À défaut, repli sur le
  // dividende du dernier exercice (montants alignés Sika Finance depuis la
  // reconstruction de la table) — c'est le rendement « trailing » standard.
  // Le repli est signalé à l'utilisateur (exercice affiché, date non publiée).
  const divRows = dividends as { montant: number; ex_date: string | null; exercice: number | null; payment_date?: string }[];
  const lastDivVerifie = divRows.find((d) => d.ex_date && d.montant > 0) ?? null;
  const lastDiv = lastDivVerifie ?? divRows.find((d) => d.montant > 0) ?? null;
  const divYield = lastDiv && last.cours_jour && last.cours_jour > 0
    ? (lastDiv.montant / last.cours_jour) * 100 : null;

  // Capitalisation boursière en MFCFA : valorisation scrapée (Sika) en priorité,
  // sinon calcul cours × shares.
  const shares = instrument?.shares ?? null;
  const capitalisation = last.valorisation != null
    ? last.valorisation / 1_000_000
    : (shares != null && last.cours_jour != null
        ? (last.cours_jour * shares) / 1_000_000 : null);

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
  const sgiFrais = await getSgiFrais().catch(() => []);
  const courtages = sgiFrais
    .map((f) => f.courtagePctMax ?? f.courtagePctMin)
    .filter((c): c is number => c != null && c > 0);
  const courtageMin = courtages.length > 0 ? Math.min(...courtages) : null;
  const courtageMax = courtages.length > 0 ? Math.max(...courtages) : null;

  const pays = instrument?.pays ?? last.pays ?? null;
  const secteur = instrument?.secteur ?? last.secteur ?? null;

  // Rendement dividende net d'IRVM (barème sourcé lib/tax — null si taux non confirmé).
  const paysFiscal = toPaysUemoa(pays);
  const divNetRes = divYield != null && paysFiscal
    ? rendementNet(divYield, paysFiscal, 'dividende_cote')
    : ({ indisponible: true } as const);
  const divYieldNet = divNetRes.indisponible ? null : divNetRes.valeur;

  // Bandeau verdict : sparkline 30j + plage observée (min/max de l'historique disponible).
  const closeHist = rows.map((r) => r.cours_jour).filter((c): c is number => c != null && c > 0);
  const sparkData = closeHist.slice(-30);
  const low52 = closeHist.length ? Math.min(...closeHist) : null;
  const high52 = closeHist.length ? Math.max(...closeHist) : null;
  const verdictLine = signal
    ? `Signal ${signal.signal}${signal.score_total != null ? ` · score ${signal.score_total.toFixed(0)}` : ''}. ` +
      `Tendance récente ${up ? 'haussière' : 'baissière'} (${(last.variation_pct ?? 0) >= 0 ? '+' : ''}${(last.variation_pct ?? 0).toFixed(2)}% sur la séance).`
    : null;

  // Ancres de navigation (uniquement les sections réellement rendues).
  const navSections = [
    { id: 'cours', label: 'Cours' },
    { id: 'technique', label: 'Technique' },
    ...(valuation && valuation.metrics.reliable ? [{ id: 'valorisation', label: 'Valorisation' }] : []),
    ...(fundamentals.length > 0 ? [{ id: 'fondamentaux', label: 'Fondamentaux' }] : []),
    { id: 'discussions', label: 'Discussions' },
  ];

  // Détections sous forme de checklist
  const detections = [
    { label: 'Momentum haussier', ok: up && (last.variation_pct ?? 0) > 1 },
    { label: 'Golden Cross (MA20 > MA50)', ok: det.goldenCross },
    { label: 'Volume > moyenne', ok: last.volume != null && last.cours_precedent != null && last.volume > 0 },
    { label: 'Cassure haussière 20j', ok: det.breakoutUp },
    { label: 'Survente RSI < 30', ok: det.oversold },
    { label: 'Surachat RSI > 70', ok: det.overbought },
    { label: 'Death Cross (baissier)', ok: det.deathCross },
    { label: 'Cassure baissière 20j', ok: det.breakoutDown },
  ].filter((d) => d.ok !== undefined);

  // Saisonnalité (série mensuelle compacte ; React.cache déduplique avec /saisonnalite).
  const seasonalityReturns = await getMonthlyReturns(code).catch(() => []);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-6 animate-rise-in">

      {/* ══════════════════════════════════════════════════
          BREADCRUMB + ACTIONS RAPIDES
      ══════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-faint">
          <Link
            href="/actions"
            className="hover:text-gold transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          >
            Marché actions
          </Link>
          <span className="text-border-strong">›</span>
          <span className="text-muted">{code}</span>
        </nav>

        {/* Actions header */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Actions primaires (pleines) */}
          <Link
            href={`/actions/${code}/revue`}
            className="inline-flex items-center gap-1 text-[11px] font-medium border border-info/40 bg-info/[0.12] rounded-full px-3 py-1 text-info hover:bg-info/20 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          >
            Revue de résultats →
          </Link>
          <Link
            href={`/actions/${code}/financials`}
            className="inline-flex items-center gap-1 text-[11px] font-medium border border-gold/40 bg-gold/[0.12] rounded-full px-3 py-1 text-gold hover:bg-gold/20 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          >
            États financiers →
          </Link>
          {/* Action contextuelle : publications */}
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

      {/* ── Navigation d'ancres collante (+ mini-header au scroll) ── */}
      <FicheStickyNav
        code={code}
        cours={last.cours_jour}
        variationPct={last.variation_pct}
        up={up}
        sections={navSections}
      />

      {/* ══════════════════════════════════════════════════
          HERO — COTATION PRINCIPALE
      ══════════════════════════════════════════════════ */}
      {/* Outer shell double-bezel */}
      <div className="rounded-panel border border-border/60 bg-border/20 p-1.5">
        <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] overflow-hidden">
          {/* Glow atmosphérique */}
          <div
            className={`absolute inset-0 pointer-events-none ${
              up ? 'bg-emerald-veil' : '[background:radial-gradient(120%_60%_at_80%_-10%,rgba(226,75,75,0.06),transparent_55%)]'
            }`}
          />
          <div className="relative px-5 pt-5 pb-6 md:px-7 md:pt-7">
            {/* Logo + identité instrument */}
            <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
              <div className="flex items-center gap-3.5 min-w-0">
                {LOGOS[code] ? (
                  /* Double-bezel logo */
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
                    <span className="text-gold/60 text-sm font-display font-medium">{code.slice(0, 2)}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] text-faint uppercase tracking-[0.18em] mb-0.5">BRVM · Action</p>
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
                {divYield != null && <StatPill tone="gold">Rdt {divYield.toFixed(1)}%</StatPill>}
              </div>
            </div>

            {/* Prix principal */}
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1 mb-1.5">
              <span className="tabular font-mono text-4xl md:text-5xl font-bold tracking-tight text-ivory leading-none">
                {fmtNumber(last.cours_jour)}
              </span>
              <span className="text-muted text-base mb-1">FCFA</span>
              {varAbs != null && (
                <span
                  className={`tabular font-mono text-base font-semibold mb-1 ${
                    up ? 'text-up' : 'text-down'
                  }`}
                >
                  {up ? '+' : ''}{fmtNumber(varAbs)}{' '}
                  <span className="text-sm opacity-80">
                    ({up ? '+' : ''}{(last.variation_pct ?? 0).toFixed(2)}%)
                  </span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-[11px] text-faint">
                Séance du <span className="text-muted">{last.date_marche}</span>
              </p>
              <FreshnessBadge fraicheur={fraicheur} />
            </div>

            {/* Séparateur or */}
            <div className="mt-5 h-px bg-gold-line opacity-40" />

            {/* Grille métriques de séance */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-4">
              {last.ouverture != null && <SessionMetric label="Ouverture" value={fmtNumber(last.ouverture)} unit="FCFA" />}
              {last.plus_haut != null && <SessionMetric label="Plus haut" value={fmtNumber(last.plus_haut)} unit="FCFA" />}
              {last.plus_bas != null && <SessionMetric label="Plus bas" value={fmtNumber(last.plus_bas)} unit="FCFA" />}
              <SessionMetric label="Clôture préc." value={fmtNumber(last.cours_precedent)} unit="FCFA" />
              <SessionMetric label="Volume du jour" value={fmtNumber(last.volume)} unit="titres" />
              <SessionMetric label="Valeur échangée" value={fmtFcfa(last.valeur_echangee)} />
              <SessionMetric label="Transactions" value={fmtNumber(last.nb_transactions)} />
              {last.beta_1an != null && <SessionMetric label="Beta 1 an" value={last.beta_1an.toFixed(2)} />}
              {volMoyen != null && <SessionMetric label="Vol. moyen 20j" value={fmtNumber(volMoyen)} unit="titres" />}
              {capitalisation != null && <SessionMetric label="Capitalisation" value={fmtNumber(Math.round(capitalisation))} unit="MFCFA" accent />}
              {shares != null && <SessionMetric label="Titres totaux" value={fmtNumber(shares)} />}
              {instrument?.flottant != null && <SessionMetric label="Titres flottant" value={fmtNumber(instrument.flottant)} />}
              {divYield != null && <SessionMetric label="Rdt dividende" value={divYield.toFixed(2)} unit="%" accent />}
              {divYieldNet != null && <SessionMetric label="Rdt net d'IRVM" value={divYieldNet.toFixed(2)} unit="%" />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bandeau verdict (note + signal + tendance + plage + synthèse) ──
          Le SIGNAL et la NOTE sont du calculé : ils suivent le flag `signaux`.
          Le cours et la plage 52 semaines, eux, restent publics — d'où un bandeau
          allégé plutôt qu'un cadenas, pour ne pas amputer la page d'entrée. */}
      {gateSignaux.allowed ? (
        <VerdictBand
          signal={signal?.signal ?? null}
          scoreTotal={signal?.score_total ?? null}
          confiance={signal?.confiance ?? null}
          sparkData={sparkData}
          up={up}
          cours={last.cours_jour}
          low52={low52}
          high52={high52}
          synthesisLine={verdictLine}
        />
      ) : (
        <VerdictBand
          signal={null}
          scoreTotal={null}
          confiance={null}
          sparkData={sparkData}
          up={up}
          cours={last.cours_jour}
          low52={low52}
          high52={high52}
          synthesisLine={null}
        />
      )}

      {/* ── Notation financière ── */}
      {instrument?.notation_json && (
        <NotationBadge
          notation={instrument.notation_json}
          notationPubs={publications.filter((p) => p.type_publication === 'notation')}
        />
      )}

      {/* ── Bannière données insuffisantes ── */}
      {rows.length < 20 && (
        <div className="border border-warn/20 bg-warn/5 rounded-card px-5 py-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="text-warn text-base leading-none">⚠</span>
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

      {/* ══════════════════════════════════════════════════
          GRAPHIQUE COURS
      ══════════════════════════════════════════════════ */}
      <div id="cours" className="scroll-mt-24">
        <Eyebrow className="mb-3">Cours & Volume</Eyebrow>
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

      {/* ══════════════════════════════════════════════════
          LIQUIDITÉ & COÛT DE FRICTION
      ══════════════════════════════════════════════════ */}
      <div id="liquidite" className="scroll-mt-24">
        <Eyebrow className="mb-3">Liquidité & coût de friction</Eyebrow>
        <LiquidityCard liquidity={liquidity} courtageMin={courtageMin} courtageMax={courtageMax} />
      </div>

      {/* ══════════════════════════════════════════════════
          MA THÈSE D'INVESTISSEMENT (suivi de conviction)
      ══════════════════════════════════════════════════ */}
      <div id="these" className="scroll-mt-24">
        <Eyebrow className="mb-3">Ma thèse</Eyebrow>
        <ThesisPanel code={code} coursActuel={last.cours_jour ?? null} />
      </div>

      {/* ══════════════════════════════════════════════════
          SAISONNALITÉ (encart résumé → page complète)
      ══════════════════════════════════════════════════ */}
      <div id="saisonnalite" className="scroll-mt-24">
        <Eyebrow className="mb-3">Saisonnalité</Eyebrow>
        <SeasonalityCard code={code} returns={seasonalityReturns} />
      </div>

      {/* ══════════════════════════════════════════════════
          CONFIGURATION TECHNIQUE (TechnicalSummary)
      ══════════════════════════════════════════════════ */}
      <div id="technique" className="scroll-mt-24">
        <Eyebrow className="mb-3">Configuration technique</Eyebrow>
        {gateIndicateurs.allowed ? (
          <TechnicalSummary result={technicalSummary} />
        ) : (
          <SectionLock
            required={gateIndicateurs.required === 'free' ? 'premium' : gateIndicateurs.required}
            titre="Configuration technique"
            pitch="Tendance, momentum et niveaux clés, synthétisés."
          />
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          INDICATEURS + DÉTECTIONS (grille 2 col)
      ══════════════════════════════════════════════════ */}
      {gateIndicateurs.allowed ? (
        <div>
          <Eyebrow className="mb-3">Analyse technique</Eyebrow>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* ── Indicateurs ── */}
            <div className="rounded-panel border border-border/60 bg-border/20 p-1.5">
              <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-5 h-full">
                <p className="text-[11px] text-gold/70 uppercase tracking-[0.18em] mb-5">Indicateurs</p>

                {/* RSI */}
                <div className="mb-5">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-muted">RSI (14)</span>
                    <span
                      className={`tabular font-semibold font-mono ${
                        lastRsi == null ? 'text-faint' :
                        lastRsi < 30 ? 'text-up' :
                        lastRsi > 70 ? 'text-down' : 'text-ivory'
                      }`}
                    >
                      {lastRsi != null ? lastRsi.toFixed(0) : '—'}
                    </span>
                  </div>
                  {/* Barre RSI premium */}
                  <div className="relative h-1.5 rounded-full overflow-hidden bg-border">
                    <div className="absolute left-0 top-0 bottom-0 w-[30%] rounded-l-full bg-gradient-to-r from-up/35 to-up/[0.08]" />
                    <div className="absolute right-0 top-0 bottom-0 w-[30%] rounded-r-full bg-gradient-to-l from-down/35 to-down/[0.08]" />
                    {lastRsi != null && <RsiCursor rsi={lastRsi} />}
                  </div>
                  <div className="flex justify-between text-[10px] text-faint mt-1.5">
                    <span>Survente &lt;30</span>
                    <span>Équilibre</span>
                    <span>Surachat &gt;70</span>
                  </div>
                  <BeginnerHint text="RSI < 30 = l'action est potentiellement survendue (bon point d'entrée possible). RSI > 70 = suracheté (prudence)." />
                </div>

                {/* Moyennes mobiles */}
                <div className="border-t border-border/30 pt-4 mb-4">
                  <p className="text-[11px] text-faint uppercase tracking-wider mb-3">Moyennes mobiles</p>
                  <div className="space-y-2">
                    {[
                      { label: 'MA 20', val: lastMa20 },
                      { label: 'MA 50', val: lastMa50 },
                      { label: 'MA 200', val: lastMa200 },
                    ].map(({ label, val }) => (
                      <div key={label} className="flex items-center justify-between text-xs">
                        <span className="text-muted">{label}</span>
                        <div className="flex items-center gap-2">
                          <span className="tabular font-mono text-ivory">
                            {val != null ? fmtNumber(val) : '—'}
                          </span>
                          {val != null && last.cours_jour != null && (
                            <span className={`text-[10px] ${last.cours_jour >= val ? 'text-up' : 'text-down'}`}>
                              {last.cours_jour >= val ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* MACD */}
                {lastMacd && (
                  <div className="border-t border-border/30 pt-4">
                    <p className="text-[11px] text-faint uppercase tracking-wider mb-3">MACD</p>
                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                      <MacdCell label="Ligne" value={lastMacd.macd?.toFixed(0) ?? '—'} />
                      <MacdCell label="Signal" value={lastMacd.signal?.toFixed(0) ?? '—'} />
                      <MacdCell
                        label="Histog."
                        value={lastMacd.hist != null
                          ? (lastMacd.hist >= 0 ? '+' : '') + lastMacd.hist.toFixed(0)
                          : '—'}
                        accent={(lastMacd.hist ?? 0) >= 0 ? 'up' : 'down'}
                      />
                    </div>
                    <BeginnerHint text="MACD positif = tendance haussière. MACD négatif = tendance baissière." />
                  </div>
                )}
              </div>
            </div>

            {/* ── Détections ── */}
            <div className="rounded-panel border border-border/60 bg-border/20 p-1.5">
              <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-5 h-full">
                <p className="text-[11px] text-gold/70 uppercase tracking-[0.18em] mb-5">Détections actives</p>
                <div className="space-y-2.5">
                  {detections.map((d) => (
                    <div
                      key={d.label}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                        d.ok
                          ? 'bg-up/5 border border-up/15'
                          : 'border border-transparent'
                      }`}
                    >
                      <span
                        className={`text-[10px] shrink-0 leading-none ${
                          d.ok ? 'text-up' : 'text-border-strong'
                        }`}
                      >
                        {d.ok ? '●' : '○'}
                      </span>
                      <span
                        className={`text-xs ${
                          d.ok ? 'text-ivory' : 'text-faint'
                        }`}
                      >
                        {d.label}
                      </span>
                    </div>
                  ))}
                  {detections.every((d) => !d.ok) && (
                    <p className="text-xs text-faint italic mt-2">Aucune détection active.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <Eyebrow className="mb-3">Analyse technique</Eyebrow>
          <SectionLock
            required={gateIndicateurs.required === 'free' ? 'premium' : gateIndicateurs.required}
            titre="Analyse technique"
            pitch="RSI, MACD, moyennes mobiles, bandes de Bollinger et détections de configurations."
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          SIGNAL DU JOUR
      ══════════════════════════════════════════════════ */}
      {gateSignaux.allowed ? (
        <div className="space-y-4">
          <Eyebrow className="mb-3">Signal quantitatif</Eyebrow>
          {signal ? (
            <>
              {(() => {
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
                return (
                  <SignalAnalysis
                    signal={signal.signal}
                    synthesis={synthesis}
                    technical={technical}
                    position={positionCtx}
                    dividend={dividend}
                  />
                );
              })()}
              <SignalPanel signal={signal} />
            </>
          ) : (
            <div className="rounded-panel border border-border bg-surface shadow-card p-6">
              <p className="text-[11px] text-gold/70 uppercase tracking-[0.18em] mb-1.5">Signal quantitatif</p>
              <p className="text-xs text-faint">Aucun signal calculé pour la dernière séance scorée.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Eyebrow className="mb-3">Signal quantitatif</Eyebrow>
          <SectionLock
            required={gateSignaux.required === 'free' ? 'premium' : gateSignaux.required}
            titre="Signal quantitatif"
            pitch="Le signal BUY / HOLD / SELL, sa note et ses sous-scores expliqués."
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          VALORISATION FONDAMENTALE
      ══════════════════════════════════════════════════ */}
      {valuation && valuation.metrics.reliable && (
        <div id="valorisation" className="scroll-mt-24">
          <Eyebrow className="mb-3">Valorisation</Eyebrow>
          {gateValo.allowed ? (
            <ValuationPanel v={valuation} scoring={scoring} />
          ) : (
            <SectionLock
              required={gateValo.required === 'free' ? 'premium' : gateValo.required}
              titre="Valorisation"
              pitch="Le titre est-il cher ou bon marché ? Multiples et valeur intrinsèque."
            />
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          FONDAMENTAUX
      ══════════════════════════════════════════════════ */}
      {fundamentals.length > 0 && (() => {
        const latest = pickBestFundamental(fundamentals)!;
        const closePrices = rows.map((r) => r.cours_jour).filter((c): c is number => c != null);
        const range52 = {
          low: closePrices.length ? Math.min(...closePrices) : null,
          high: closePrices.length ? Math.max(...closePrices) : null,
          current: last.cours_jour ?? null,
        };
        // Verrou premium : on ne rend PAS le panneau (donc aucune donnée dans le HTML).
        if (!gateFonda.allowed) {
          return (
            <div id="fondamentaux" className="scroll-mt-24">
              <Eyebrow className="mb-3">Analyse fondamentale</Eyebrow>
              <SectionLock
                required={gateFonda.required === 'free' ? 'premium' : gateFonda.required}
                titre="Analyse fondamentale"
                pitch="PER, P/B, ROE, marge, endettement — et leur lecture."
              />
            </div>
          );
        }

        return (
          <div id="fondamentaux" className="scroll-mt-24">
            <Eyebrow className="mb-3">Analyse fondamentale</Eyebrow>
            <FundamentalsPanel
              code={code}
              year={latest.year}
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
              famille={(instrument as { famille_comptable?: 'banque' | 'assurance' | 'general' | null } | null)?.famille_comptable ?? null}
              dividendeExercice={lastDiv?.exercice ?? null}
              dividendeVerifie={lastDivVerifie != null}
            />

            {/* Constructeur de graphique — séries au choix, base 100 optionnelle */}
            {chartRows.length >= 2 && (
              <div className="mt-4">
                <Eyebrow className="mb-3">Graphique personnalisé</Eyebrow>
                <ChartBuilder rows={chartRows} />
              </div>
            )}
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════
          DIVIDENDES + ÉVÉNEMENTS
      ══════════════════════════════════════════════════ */}
      <div>
        <Eyebrow className="mb-3">Corporate & Dividendes</Eyebrow>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Dividendes */}
          <div className="rounded-panel border border-border/60 bg-border/20 p-1.5">
            <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-5">
              <p className="text-[11px] text-gold/70 uppercase tracking-[0.18em] mb-5">Dividendes</p>
              {lastDiv ? (
                <div>
                  {/* Rendement en vedette */}
                  {divYield != null && (
                    <div className="mb-4 flex items-baseline gap-2">
                      <span className="tabular font-mono text-3xl font-bold text-up leading-none">
                        {divYield.toFixed(2)}%
                      </span>
                      <span className="text-xs text-muted">rendement estimé</span>
                    </div>
                  )}
                  <div className="space-y-0 border-t border-border/30 pt-3">
                    <DivRow label="Montant" value={fmtNumber(lastDiv.montant) + ' FCFA'} />
                    <DivRow label="Ex-date" value={lastDiv.ex_date ?? '—'} />
                    {lastDiv.payment_date && <DivRow label="Paiement" value={lastDiv.payment_date} />}
                  </div>
                  <p className="text-[10px] text-faint mt-3">Rendement calculé sur le cours actuel</p>
                </div>
              ) : (
                <p className="text-xs text-faint italic">Aucun dividende enregistré.</p>
              )}
            </div>
          </div>

          {/* Événements */}
          <div className="rounded-panel border border-border/60 bg-border/20 p-1.5">
            <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-5">
              <p className="text-[11px] text-gold/70 uppercase tracking-[0.18em] mb-5">Événements récents</p>
              {events.length > 0 ? (
                <div className="space-y-3.5">
                  {(events as { id: string; title: string; event_date: string; event_type: string; sentiment?: string }[]).map((e) => (
                    <div key={e.id} className="border-b border-border/30 pb-3.5 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-faint tabular">{e.event_date}</span>
                        <span className="text-[10px] border border-border/60 rounded-full px-2 py-px text-faint">
                          {e.event_type}
                        </span>
                      </div>
                      <p className="text-xs text-muted line-clamp-2 mb-1.5">{e.title}</p>
                      <Link
                        href={`/dashboard/reports/events/${e.id}`}
                        className="text-[11px] text-gold/70 hover:text-gold transition-colors duration-300"
                      >
                        Lire l'analyse →
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-faint italic">Aucun événement récent.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          GRAPHIQUES INDICATEURS (RSI/MACD historiques)
      ══════════════════════════════════════════════════ */}
      <div>
        <Eyebrow className="mb-3">Indicateurs historiques</Eyebrow>
        {gateIndicateurs.allowed ? (
          <PremiumPanel className="p-0 overflow-hidden">
            <div className="px-4 py-4 md:px-5 space-y-4">
              <IndicatorCharts data={indicatorData} />
              {(() => {
                const lastOf = (arr: (number | null)[]) => { for (let k = arr.length - 1; k >= 0; k--) if (arr[k] != null) return arr[k]!; return null; };
                const reading = readIndicators({
                  rsi: lastOf(indicatorData.map((d) => d.rsi)),
                  macd: lastOf(indicatorData.map((d) => d.macd)),
                  ma20: lastOf(ma20),
                  ma50: lastOf(ma50),
                });
                return <IndicatorCommentary reading={reading} code={code} />;
              })()}
            </div>
          </PremiumPanel>
        ) : (
          <EmptyStatePremium
            icon="🔒"
            title={`Indicateurs techniques — réservés au plan ${gateIndicateurs.required === 'pro' ? 'Platinium' : 'Premium'}`}
            hint="RSI, MACD, moyennes mobiles, lecture technique et explication par l'IA."
            action={{
              href: '/account/plan',
              label: `Passer à ${gateIndicateurs.required === 'pro' ? 'Platinium' : 'Premium'}`,
            }}
          />
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          ACTIONS RAPIDES
      ══════════════════════════════════════════════════ */}
      <div>
        <Eyebrow className="mb-3">Actions</Eyebrow>
        <div className="rounded-panel border border-border/60 bg-border/20 p-1.5">
          <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {[
                { href: '/portefeuille', label: 'Ajouter à la watchlist', icon: '★' },
                { href: '/parametres/alertes', label: 'Créer une alerte prix', icon: '◎' },
                { href: `/api/export/actions/${code}`, label: 'Exporter CSV', icon: '↓', external: true },
                { href: `/backtest?code=${code}`, label: 'Lancer un backtest', icon: '⌛' },
                { href: `/actions/${code}/rapport`, label: 'Rapport PDF analyste', icon: '▤', external: true },
                { href: `/assistant?symbole=${code}`, label: "Analyser avec l'IA", icon: '◈' },
              ].map(({ href, label, icon, external }) => {
                const cls =
                  'group flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-xs text-muted hover:border-gold/30 hover:text-ivory hover:bg-gold/[0.03] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';
                const inner = (
                  <>
                    <span className="text-gold/50 group-hover:text-gold/80 transition-colors duration-300 text-sm leading-none shrink-0">
                      {icon}
                    </span>
                    <span>{label}</span>
                    <span className="ml-auto text-border-strong group-hover:text-gold/40 transition-colors duration-300">→</span>
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
      </div>

      {/* ══════════════════════════════════════════════════
          DISCUSSIONS FORUM
      ══════════════════════════════════════════════════ */}
      <section id="discussions" className="mt-8 space-y-3 scroll-mt-24">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Discussions</h2>
          <Link href="/forum/nouveau" className="text-sm text-info hover:underline">Démarrer une discussion</Link>
        </div>
        <ForumTopicList topics={forumTopics} authors={forumAuthors} />
      </section>

    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS
// ══════════════════════════════════════════════════════════════════

/** Métrique de séance — affichage compact dans le hero */
function SessionMetric({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className="py-0.5">
      <p className="text-[10px] text-faint uppercase tracking-[0.12em] mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={`tabular font-mono text-sm font-semibold leading-tight ${accent ? 'text-gold' : 'text-ivory'}`}>
          {value}
        </span>
        {unit && <span className="text-[10px] text-faint">{unit}</span>}
      </div>
    </div>
  );
}

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
      <div className="text-faint text-[10px] mb-1">{label}</div>
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
          <p className="text-[11px] text-gold/70 uppercase tracking-[0.18em]">Signal quantitatif</p>
          <SignalBadge signal={signal.signal} confiance={signal.confiance} />
          <RatingBadge scoreTotal={signal.score_total} confiance={signal.confiance} />
          <span className="ml-auto tabular text-[11px] text-faint font-mono">
            {signal.score_total != null
              ? (signal.score_total >= 0 ? '+' : '') + signal.score_total.toFixed(2)
              : '—'}
            {' / 1.00 · dernière séance scorée '}{signal.date_marche}
          </span>
        </div>

        <BeginnerHint text="Score > 60 = signal favorable. Score < 40 = signal défavorable. Entre les deux = neutre." />

        <p className="text-sm text-muted mb-5 leading-relaxed">
          {signal.explication ?? 'Signal calculé automatiquement.'}
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
              <p className="text-[11px] text-faint uppercase tracking-wider mb-3">Sous-scores</p>
              <div className="space-y-2">
                {subScoreRows.map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-muted font-mono">{label}</span>
                    <span
                      className={`tabular font-mono font-semibold ${
                        (val as number) >= 0 ? 'text-up' : 'text-down'
                      }`}
                    >
                      {(val as number) >= 0 ? '+' : ''}{(val as number).toFixed(2)}
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
              <p className="text-[11px] text-faint uppercase tracking-wider mb-3">Indicateurs utilisés</p>
              <div className="space-y-2">
                {entries.slice(0, 6).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <span className="text-muted font-mono">{k}</span>
                    <span className="tabular font-mono text-faint">
                      {typeof v === 'number' ? v.toFixed(3) : String(v)}
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
            className="text-xs text-gold/70 hover:text-gold transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          >
            Voir tous les signaux →
          </Link>
        </div>
      </div>
    </div>
  );
}
