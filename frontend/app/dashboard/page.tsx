import Link from 'next/link';
import { NB_SOCIETES_COTEES } from '@/lib/universe';
import { createClient } from '@/lib/supabase/server';
import FreshnessBadge from '@/components/FreshnessBadge';
import { computeFreshness } from '@/lib/freshness';
import { loadFreshnessInputs } from '@/lib/freshness/queries';
import NewsTicker from '@/components/NewsTicker';
import MarketSessionBanner from '@/components/landing/MarketSessionBanner';
import MarketStateCard, { type MarketStats } from '@/components/MarketStateCard';
import DashboardTicker, { type TickerLine } from '@/components/dashboard/DashboardTicker';
import FavoriteSectors from '@/components/dashboard/FavoriteSectors';
import { chargerProfil } from '@/lib/dashboard/profil';
import { resolveLayout, grouperEnRangees, classeRangee, type WidgetKey, type DashboardLayout, type Profil } from '@/lib/dashboard/widgets';
import type { PortfolioState } from '@/lib/portfolio/derive';
import { construireAgenda, plusJours, HORIZON_JOURS } from '@/lib/dashboard/agenda';
import { performanceJour } from '@/lib/dashboard/performanceJour';
import { metriquesDepuisSeance, estSeanceClose } from '@/lib/dashboard/metriquesSeance';
import { preparerPublications } from '@/lib/dashboard/publications';
import { lignesPerfDepuis, variationsDuJour } from '@/lib/dashboard/portefeuilleBloc';
import { chargerPortefeuille, chargerDividendes, chargerFermetures, chargerPublications, chargerLiquidite } from '@/lib/dashboard/chargement';
import BlocComprendre from '@/components/dashboard/blocs/BlocComprendre';
import BlocAgenda from '@/components/dashboard/blocs/BlocAgenda';
import BlocPublications from '@/components/dashboard/blocs/BlocPublications';
import BlocLiquidite from '@/components/dashboard/blocs/BlocLiquidite';
import BlocPortefeuille from '@/components/dashboard/blocs/BlocPortefeuille';
import TopMovers from '@/components/TopMovers';
import RecentSignalsCard from '@/components/RecentSignalsCard';
import BriefAssistant from '@/components/dashboard/BriefAssistant';
import KeyMetrics from '@/components/dashboard/KeyMetrics';
import WeeklyIndexChart from '@/components/dashboard/WeeklyIndexChart';
import NewsFeed from '@/components/dashboard/NewsFeed';
import MarketIndices from '@/components/dashboard/MarketIndices';
import IntraDaySignalsWidget from '@/components/dashboard/IntraDaySignalsWidget';
import PatternSummaryWidget from '@/components/dashboard/PatternSummaryWidget';
import { PremiumLock } from '@/components/dashboard/PremiumLock';
import { AfricanIndicesCard } from '@/components/AfricanIndicesCard';
import { MacroBanner } from '@/components/MacroBanner';
import { getWeeklyIndex } from '@/lib/dashboard/weeklyIndex';
import { fmtFcfa } from '@/lib/format';
import type { ActionDaily, IndiceDaily, SignalDaily } from '@/lib/types';
import { generateBrief, computeTopSectorPerfs, type Brief } from '@/lib/brief';
import CarnetCommentaire from '@/components/CarnetCommentaire';
import type { CarnetSeance as CarnetVedette } from '@/lib/carnet/commentaire';
import { canAccess } from '@/lib/server/featureAccess';
import {
  SectionHeader,
  EmptyStatePremium,
  PremiumCTA,
  StatPill,
  PremiumPanel,
} from '@/components/ui/premium';
import { BeamButton } from '@/components/ui/beam-button';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

async function getData() {
  const supabase = createClient();

  const { data: lastRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, actions: [], indices: [], signals: [], prevValeur: null, prevBreadth: null as number | null, sparklines: {} as Record<string, number[]>, summary: null as MarketSummaryRow | null, summaryPrev: null as MarketSummaryRow | null, brief: null, ticker: [] as TickerLine[] };

  // Date précédente pour le delta volume
  const { data: prevDateRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .lt('date_marche', lastDate)
    .order('date_marche', { ascending: false })
    .limit(1);
  const prevDate = prevDateRow?.[0]?.date_marche ?? null;

  // Les indices ne sont pas toujours scrapés à la même date que les cours.
  const { data: lastIdxRow } = await supabase
    .from('brvm_indices_daily')
    .select('date_marche')
    .not('valeur', 'is', null)
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastIdxDate = lastIdxRow?.[0]?.date_marche ?? lastDate;

  const [{ data: actions }, { data: indices }, { data: signals }, { data: prevActions }, { data: summaryRows }] =
    await Promise.all([
      supabase.from('brvm_actions_daily').select('*').eq('date_marche', lastDate),
      supabase.from('brvm_indices_daily').select('*').eq('date_marche', lastIdxDate),
      supabase
        .from('signals_daily')
        .select('code, signal, confiance, explication, score_total, date_marche')
        .eq('date_marche', lastDate)
        .neq('signal', 'HOLD')
        .order('confiance', { ascending: false })
        .limit(6),
      prevDate
        ? supabase
            .from('brvm_actions_daily')
            .select('valeur_echangee, variation_pct')
            .eq('date_marche', prevDate)
        : Promise.resolve({ data: [] }),
      // Résumés de CES deux séances (et non « les deux derniers ») : un résumé
      // d'une autre séance comparé aux cours du jour serait incohérent.
      supabase
        .from('brvm_market_summary')
        .select('date_marche, valeur_transactions, capitalisation_actions, capitalisation_obligations')
        .in('date_marche', prevDate ? [lastDate, prevDate] : [lastDate]),
    ]);
  const resumes = (summaryRows ?? []) as MarketSummaryRow[];
  const summary = resumes.find((r) => r.date_marche === lastDate) ?? null;
  const summaryPrev = prevDate ? resumes.find((r) => r.date_marche === prevDate) ?? null : null;

  const prevRows = (prevActions ?? []) as { valeur_echangee: number | null; variation_pct: number | null }[];
  const prevValeur = prevDate
    ? prevRows.reduce((s, a) => s + (a.valeur_echangee ?? 0), 0)
    : null;

  // Sentiment de la veille (breadth) pour dériver le delta « vs veille »
  let prevBreadth: number | null = null;
  if (prevDate && prevRows.length > 0) {
    let h = 0, b = 0;
    for (const a of prevRows) {
      const v = a.variation_pct ?? 0;
      if (v > 0) h++;
      else if (v < 0) b++;
    }
    prevBreadth = h + b > 0 ? (h / (h + b)) * 100 : null;
  }

  const typedActions = (actions ?? []) as ActionDaily[];
  const typedIndices = (indices ?? []) as IndiceDaily[];
  const typedSignals = (signals ?? []) as SignalDaily[];

  const topSectorPerfs = computeTopSectorPerfs(typedActions);
  const brief = generateBrief({
    date: lastDate,
    indices: {
      brvm30: typedIndices.find((i) => i.code === 'BRVM30') ?? null,
      brvmc:  typedIndices.find((i) => i.code === 'BRVMC')  ?? null,
    },
    actions: typedActions,
    signals: typedSignals,
    valeurTransactions: summary?.valeur_transactions ?? null,
    valeurTransactionsPrev: summaryPrev?.valeur_transactions ?? null,
    topSectorPerfs,
  });

  // Valeur commentée du jour : celle qui porte le signal le plus assuré, à
  // défaut la plus échangée de la séance. Aucune des deux n'est un conseil —
  // c'est simplement la valeur dont il y a le plus à dire.
  const vedetteCode =
    typedSignals[0]?.code ??
    [...typedActions].sort((a, b) => (b.valeur_echangee ?? 0) - (a.valeur_echangee ?? 0))[0]?.code ??
    null;

  const [{ data: carnetVedette }, { data: actusVedette }] = vedetteCode
    ? await Promise.all([
        supabase
          .from('brvm_carnet_daily')
          .select('date_marche, qte_achat, cours_achat, qte_vente, cours_vente, achat_au_marche, vente_au_marche, cours_reference')
          .eq('code', vedetteCode)
          .order('date_marche', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('brvm_news')
          .select('titre, date_publication')
          .not('hidden', 'is', true) // modération rédactionnelle
          .eq('instrument_code', vedetteCode)
          .lte('date_publication', new Date().toISOString().slice(0, 10))
          .order('date_publication', { ascending: false })
          .limit(2),
      ])
    : [{ data: null }, { data: null }];

  const vedette = vedetteCode
    ? {
        code: vedetteCode,
        carnet: (carnetVedette ?? null) as CarnetVedette | null,
        signal: typedSignals[0]
          ? {
              date_marche: typedSignals[0].date_marche,
              signal: typedSignals[0].signal,
              confiance: typedSignals[0].confiance ?? null,
              score_total: (typedSignals[0] as { score_total?: number | null }).score_total ?? null,
              explication: (typedSignals[0] as { explication?: string | null }).explication ?? null,
              sousScores: (() => {
                const s = typedSignals[0] as unknown as Record<string, unknown>;
                const n = (k: string) => (typeof s[k] === 'number' ? (s[k] as number) : null);
                return { variation: n('score_variation'), volume: n('score_volume'), rsi: n('score_rsi'), macd: n('score_macd'), tendance: n('bonus_tendance') };
              })(),
            }
          : null,
        // Les capitaux de la séance : l'étalon qui empêche de lire un reliquat
        // de carnet comme un rapport de force.
        valeurEchangee: typedActions.find((a) => a.code === vedetteCode)?.valeur_echangee ?? null,
        actualites: (actusVedette ?? []) as { titre: string; date_publication: string }[],
      }
    : null;

  // Historique cours (10 dernières séances) pour tous les codes — sparklines TopMovers
  const { data: histRows } = await supabase
    .from('brvm_actions_daily')
    .select('code, cours_jour, date_marche')
    .not('cours_jour', 'is', null)
    .order('date_marche', { ascending: false })
    .limit(10 * (typedActions.length || NB_SOCIETES_COTEES)); // 10 séances × le nombre réel de valeurs cotées

  const sparklines: Record<string, number[]> = {};
  for (const row of (histRows ?? []) as { code: string; cours_jour: number; date_marche: string }[]) {
    (sparklines[row.code] ??= []).push(row.cours_jour);
  }
  // reverse: on a trié desc → on remet chronologique
  for (const k of Object.keys(sparklines)) sparklines[k]!.reverse();

  // Ticker permanent : actions + obligations de la dernière séance disponible
  const { data: oblRows } = await supabase
    .from('brvm_obligations_daily')
    .select('*')
    .order('date_marche', { ascending: false })
    .limit(80);
  const oblLatest = oblRows && oblRows.length > 0 ? (oblRows[0] as Record<string, unknown>).date_marche : null;
  const obligations = ((oblRows ?? []) as Record<string, unknown>[]).filter((o) => o.date_marche === oblLatest);

  const nfmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  const ticker: TickerLine[] = [
    ...typedActions
      .filter((a) => a.cours_jour != null)
      .map((a) => ({ code: a.code, value: nfmt(a.cours_jour as number), variation: a.variation_pct ?? null, kind: 'action' as const, spark: sparklines[a.code]?.slice(-7), cours: a.cours_jour as number })),
    ...obligations
      .filter((o) => o.cours_jour != null)
      .map((o) => {
        const cours = o.cours_jour as number;
        const prev = (o.cours_precedent ?? null) as number | null;
        const variation =
          (o.variation_pct as number | null) ?? (prev != null && prev > 0 ? ((cours - prev) / prev) * 100 : null);
        return { code: String(o.code), value: nfmt(cours), variation, kind: 'obligation' as const };
      }),
  ];

  return {
    vedette,
    lastDate,
    actions: typedActions,
    indices: typedIndices,
    signals: typedSignals,
    prevValeur,
    prevBreadth,
    sparklines,
    summary,
    summaryPrev,
    brief,
    ticker,
  };
}

interface MarketSummaryRow {
  date_marche: string;
  valeur_transactions: number | null;
  capitalisation_actions: number | null;
  capitalisation_obligations: number | null;
}

function marketStats(actions: ActionDaily[], prevValeur: number | null): MarketStats {
  let hausses = 0, baisses = 0, stables = 0;
  let valeurReelle = 0, valeurEstimee = 0, titresEchanges = 0, transactions = 0;
  let hasValeur = false, hasTransactions = false, hasTitres = false;
  for (const a of actions) {
    const v = a.variation_pct ?? 0;
    if (v > 0) hausses++;
    else if (v < 0) baisses++;
    else stables++;

    if (a.valeur_echangee != null) { valeurReelle += a.valeur_echangee; hasValeur = true; }
    if (a.volume != null) {
      titresEchanges += a.volume; hasTitres = true;
      if (a.cours_jour != null) valeurEstimee += a.cours_jour * a.volume;
    }
    if (a.nb_transactions != null) { transactions += a.nb_transactions; hasTransactions = true; }
  }

  // Valeur échangée : réelle si disponible, sinon estimée (cours × titres)
  const volumeTotal = hasValeur ? valeurReelle : (hasTitres ? valeurEstimee : null);
  return {
    hausses, baisses, stables, total: actions.length,
    volumeTotal,
    volumeEstimated: !hasValeur && hasTitres,
    volumePrev: prevValeur,
    titresEchanges: hasTitres ? titresEchanges : null,
    transactions: hasTransactions ? transactions : null,
  };
}

export default async function Dashboard() {
  const { lastDate, actions, indices, signals, prevValeur, prevBreadth, sparklines, summary, summaryPrev, brief, ticker, vedette } = await getData();

  // Fraîcheur des cours — affichée au-dessus du ticker permanent.
  // `lecture_seance` verrouille l'encart « Ce que dit la séance · CODE » plus bas :
  // vérifié ici, en parallèle, pour ne pas ajouter d'aller-retour dédié.
  const [fIn, gateLectureSeance] = await Promise.all([
    loadFreshnessInputs(),
    canAccess('lecture_seance'),
  ]);
  const fraicheurCours = computeFreshness(fIn.derniereCollecte, fIn.derniereSeance, new Date());

  // Secteurs favoris de l'utilisateur (paramétrage intelligent).
  const supa = createClient();
  const { data: { user } } = await supa.auth.getUser();
  let favoriteSectors: string[] = [];
  let dashboardLayout: DashboardLayout | null = null;
  let triggeredAlerts = 0;
  let profil: Profil = 'debutant';
  // Un visiteur non connecté est traité comme non-premium. Les sections premium
  // sont montrées mais verrouillées : on donne envie plutôt que de cacher.
  let isPremium = false;
  if (user) {
    const [{ data: prof }, { count }, profilCharge] = await Promise.all([
      supa.from('profiles').select('favorite_sectors, preferences, is_premium').eq('id', user.id).maybeSingle(),
      supa
        .from('alerts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('actif', true)
        .not('declenchee_le', 'is', null),
      chargerProfil(supa, user.id),
    ]);
    favoriteSectors = (prof?.favorite_sectors as string[] | null) ?? [];
    dashboardLayout = ((prof?.preferences as Record<string, unknown> | null)?.dashboard as DashboardLayout) ?? null;
    isPremium = Boolean(prof?.is_premium);

    triggeredAlerts = count ?? 0;
    profil = profilCharge;
  }
  const layout = resolveLayout(dashboardLayout, profil);

  /* ── État vide premium ──────────────────────────────────────────────────── */
  if (!lastDate) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
          <SectionHeader
            kicker="Tableau de bord"
            title="Marché BRVM"
            subtitle="Bourse Régionale des Valeurs Mobilières · UEMOA"
          />
          <EmptyStatePremium
            icon="◈"
            title="Aucune donnée de séance"
            hint="Lancez le scraper pour alimenter la base de données de marché."
            action={{ href: '/actions', label: 'Actualiser' }}
          />
        </div>
      </div>
    );
  }

  const stats = marketStats(actions, prevValeur);
  // Valeur échangée réelle (brvm.org) prioritaire sur l'estimation per-instrument
  if (summary?.valeur_transactions != null) {
    stats.volumeTotal = summary.valeur_transactions;
    stats.volumeEstimated = false;
    stats.volumePrev = summaryPrev?.valeur_transactions ?? null;
  }
  const withVar = actions.filter((a) => a.variation_pct != null);
  const gainers = [...withVar].sort((a, b) => (b.variation_pct ?? 0) - (a.variation_pct ?? 0)).slice(0, 5);
  const losers  = [...withVar].sort((a, b) => (a.variation_pct ?? 0) - (b.variation_pct ?? 0)).slice(0, 5);

  // Sentiment 0..100 dérivé du breadth (hausses / (hausses+baisses)) ; delta vs veille en points
  const sentimentScore = stats.hausses + stats.baisses > 0
    ? (stats.hausses / (stats.hausses + stats.baisses)) * 100
    : 50;
  const sentimentDelta = prevBreadth != null ? sentimentScore - prevBreadth : null;

  // Détail des valeurs par mouvement (pour les info-bulles au survol)
  const toMover = (a: ActionDaily) => ({ code: a.code, cours: a.cours_jour ?? null, variation: a.variation_pct ?? 0 });
  const breakdown = {
    hausses: withVar.filter((a) => (a.variation_pct ?? 0) > 0)
      .sort((a, b) => (b.variation_pct ?? 0) - (a.variation_pct ?? 0)).map(toMover),
    baisses: withVar.filter((a) => (a.variation_pct ?? 0) < 0)
      .sort((a, b) => (a.variation_pct ?? 0) - (b.variation_pct ?? 0)).map(toMover),
    stables: withVar.filter((a) => (a.variation_pct ?? 0) === 0).map(toMover),
  };

  const dateLabel = new Date(lastDate).toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  // ── Blocs adaptatifs : on ne lit que ce que le layout affiche ──────────────
  const aujourdhui = new Date().toISOString().slice(0, 10); // Abidjan = UTC+0
  const veut = (k: WidgetKey) => layout.includes(k);
  const besoinPortefeuille = veut('portefeuille') || veut('agenda') || veut('publications') || veut('liquidite');
  const finAgenda = plusJours(aujourdhui, HORIZON_JOURS);
  const depuisPublications = plusJours(aujourdhui, -7);
  const [etatPortefeuille, dividendes, fermetures, publicationsBrutes, liquidite] = await Promise.all([
    user && besoinPortefeuille
      ? chargerPortefeuille(supa, user.id, aujourdhui)
      : Promise.resolve<PortfolioState | null | undefined>(undefined),
    veut('agenda') ? chargerDividendes(supa, aujourdhui, finAgenda) : Promise.resolve([]),
    veut('agenda') ? chargerFermetures(supa, aujourdhui, finAgenda) : Promise.resolve([]),
    veut('publications') ? chargerPublications(supa, depuisPublications) : Promise.resolve([]),
    veut('liquidite') ? chargerLiquidite(supa) : Promise.resolve(null),
  ]);
  const titresDetenus = (etatPortefeuille?.positions ?? []).filter((p) => !p.isLiquidites);
  const quantites = new Map(titresDetenus.map((p) => [p.code.trim().toUpperCase(), p.quantite]));
  const agenda = dividendes === null || fermetures === null
    ? null
    : construireAgenda({
        aujourdhui,
        dividendes,
        assemblees: [], // spec §4.1 : vide tant qu'aucune date de RÉUNION n'est collectée
        fermetures,
        positions: titresDetenus.map((p) => ({ code: p.code, quantite: p.quantite })),
      });
  const publications = publicationsBrutes === null ? null : preparerPublications(publicationsBrutes, new Set(quantites.keys()));
  const coursSeance = actions.map((a) => ({ code: a.code, cours_jour: a.cours_jour, variation_pct: a.variation_pct, date_marche: a.date_marche }));
  const brvmc = indices.find((i) => i.code === 'BRVMC');
  const perf = etatPortefeuille
    ? performanceJour(
        lignesPerfDepuis(etatPortefeuille.positions, coursSeance, lastDate),
        brvmc ? { variationPct: brvmc.variation_pct, dateMarche: brvmc.date_marche } : null,
      )
    : null;
  const metriques = metriquesDepuisSeance({
    dateMarche: lastDate,
    actions,
    indices,
    valeurTransactions: summary?.valeur_transactions ?? null,
    valeurTransactionsVeille: summaryPrev?.valeur_transactions ?? null,
  });
  const seanceClose = estSeanceClose(lastDate, new Date());

  const [weekly30, weeklyC] = await Promise.all([
    getWeeklyIndex('BRVM30', 'BRVM 30'),
    getWeeklyIndex('BRVMC', 'BRVM Composite'),
  ]);

  // Widgets configurables (ordre + visibilité pilotés par le layout utilisateur).
  const sections: Record<WidgetKey, React.ReactNode> = {
    secteurs: user ? (
      <section aria-label="Vos secteurs">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-display text-lg text-white">Vos secteurs</h2>
          <span className="rounded-full bg-gradient-to-r from-accent to-up px-2 py-0.5 text-[9px] font-bold text-bg">PERSO</span>
        </div>
        <FavoriteSectors favorites={favoriteSectors} />
      </section>
    ) : null,
    indices: (
      <section aria-label="Indices BRVM">
        <MarketIndices indices={indices} />
      </section>
    ),
    etat: (
      <section aria-label="État du marché">
        <MarketStateCard stats={stats} sentimentScore={sentimentScore} sentimentDelta={sentimentDelta} breakdown={breakdown} />
      </section>
    ),
    seance: (
      <section aria-label="Séance du jour">
        {/* Verrou premium `lecture_seance` : sur ce tableau de bord déjà dense en
            CTA (signaux, patterns intraday plus bas), un cadenas de plus pour un
            encart qui met en avant une valeur choisie automatiquement — pas
            recherchée par l'utilisateur — ajouterait de la fatigue sans le
            justifier. On omet donc le bloc entier plutôt que d'y mettre un
            SectionLock ; la fiche action, elle, explique l'offre avec un vrai
            pitch. Rien ne fuit : le bloc (titre + lien + composant) ne rend
            rien du tout, sans cadre ni marge orpheline. */}
        {vedette && gateLectureSeance.allowed && (
          <div className="mb-4 rounded-panel border border-border bg-surface p-4">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-ivory">Ce que dit la séance · {vedette.code}</h3>
              <Link href={`/actions/${vedette.code}`} className="text-xs font-semibold text-accent-ink hover:underline">Voir la fiche →</Link>
            </div>
            <CarnetCommentaire
              carnet={vedette.carnet}
              signal={vedette.signal}
              actualites={vedette.actualites}
              contexte={{ valeurEchangee: vedette.valeurEchangee }}
              compact
            />
          </div>
        )}
        <p className="overline text-muted mb-4 tracking-[0.16em]">Séance du jour</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <TopMovers title="Top 5 hausses" rows={gainers} signals={signals as SignalDaily[]} direction="up" sparklines={sparklines} />
          <TopMovers title="Top 5 baisses" rows={losers} signals={signals as SignalDaily[]} direction="down" sparklines={sparklines} />
          <div className="space-y-4">
            <WeeklyIndexChart {...weekly30} />
            <WeeklyIndexChart {...weeklyC} />
          </div>
          <div className="rounded-panel border border-border bg-border/30 p-1.5">
            <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] px-4 py-4 h-full flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ivory">Brief analytique</h3>
                <BriefAssistant />
              </div>
              <KeyMetrics summary={summary} summaryPrev={summaryPrev} />
              {brief?.summary && (
                <div className="border-t border-border/40 pt-3">
                  <p className="overline text-faint mb-1.5">Analyse du jour</p>
                  <p className="text-[13px] leading-relaxed text-ivory/80">{brief.summary}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    ),
    signaux: (
      <section aria-label="Signaux récents">
        <p className="overline text-muted mb-4 tracking-[0.16em]">Signaux actionnables</p>
        {isPremium ? (
          <RecentSignalsCard signals={signals as SignalDaily[]} />
        ) : (
          <PremiumLock
            title="Signaux d’achat et de vente réservés au Premium"
            pitch="Les signaux d'achat et de vente notés A–F, avec leur explication, sont inclus dans l'abonnement Premium."
            rows={3}
          />
        )}
      </section>
    ),
    actus: (
      <section aria-label="Actualités">
        <p className="overline text-muted mb-4 tracking-[0.16em]">Actualités</p>
        <NewsFeed />
      </section>
    ),
    portefeuille: (
      <BlocPortefeuille etat={etatPortefeuille} perf={perf} variations={variationsDuJour(coursSeance, lastDate)} />
    ),
    comprendre: <BlocComprendre metriques={metriques} close={seanceClose} />,
    agenda: <BlocAgenda items={agenda} aujourdhui={aujourdhui} quantites={quantites} />,
    publications: <BlocPublications items={publications} depuis={depuisPublications} />,
    liquidite: (
      <BlocLiquidite
        donnees={liquidite}
        positions={titresDetenus.map((p) => ({ code: p.code, valeur: p.cours > 0 ? p.valeur : null }))}
        dateSeance={lastDate}
      />
    ),
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Halo atmosphérique ────────────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-obsidian-glow"
        aria-hidden
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8">

        {/* ── En-tête : titre éditorial + nav pills ───────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-5 pb-2">
          <div>
            {/* Eyebrow dorée */}
            <p className="overline text-gold/60 mb-2 tracking-[0.22em]">
              Bourse Régionale des Valeurs Mobilières
            </p>
            <h1 className="font-display text-3xl md:text-4xl text-ivory tracking-tight leading-none">
              Tableau de bord
            </h1>
            {/* Date pill */}
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/20 bg-gold/[0.06] px-3 py-1 text-[11px] font-medium text-gold/80">
                <span className="h-1.5 w-1.5 rounded-full bg-up animate-pulse" />
                Séance du {dateLabel}
              </span>
            </div>
          </div>

          {/* Actions nav */}
          <nav className="flex items-center gap-2" aria-label="Navigation rapide">
            <BeamButton href="/signaux">Signaux</BeamButton>
            <BeamButton href="/portefeuille">Portefeuille</BeamButton>
            {user && (
              <Link href="/dashboard/personnaliser" className="rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:text-accent hover:border-accent/40 transition-colors" title="Personnaliser le tableau de bord">
                ⚙︎ Personnaliser
              </Link>
            )}
            {/* Passage vers la seconde version du tableau de bord. Les deux
                cohabitent : cette page-ci ne change pas, l'autre propose une
                hiérarchie différente du même marché. Sans ce lien, /dashboard/v2
                n'est atteignable qu'en connaissant l'URL par cœur. */}
            <Link
              href="/dashboard/v2"
              className="rounded-full border border-accent/30 px-3 py-1.5 text-xs text-accent transition-colors hover:border-accent/60 hover:bg-accent/[0.06]"
              title="Essayer la nouvelle version du tableau de bord"
            >
              Version v2 →
            </Link>
          </nav>
        </header>

        {/* ── Ticker actualités BRVM ─────────────────────────────────────── */}
        <NewsTicker className="-mx-4 sm:-mx-6 rounded-none" />

        {/* ── État de la séance (déplacé depuis la page d'accueil) ─────────── */}
        <MarketSessionBanner />

        {/* ── Ticker permanent : cours actions + obligations ──────────────── */}
        <div className="flex justify-end px-1">
          <FreshnessBadge fraicheur={fraicheurCours} />
        </div>
        <DashboardTicker items={ticker} dateMarche={lastDate} />

        {/* ── Bandeau alertes déclenchées ──────────────────────────────────── */}
        {triggeredAlerts > 0 && (
          <Link
            href="/parametres/alertes"
            className="flex w-full items-center gap-2 rounded-lg border border-down/30 bg-down/10 px-4 py-2 text-sm text-down transition-colors hover:bg-down/20"
          >
            <span className="animate-pulse" aria-hidden>●</span>
            <span>
              {triggeredAlerts} alerte{triggeredAlerts > 1 ? 's' : ''} déclenchée{triggeredAlerts > 1 ? 's' : ''}
            </span>
            <span className="ml-auto">→</span>
          </Link>
        )}

        {/* ── Widgets configurables, par rangées (spec §4.0) ── */}
        {grouperEnRangees(layout.filter((k) => sections[k] != null)).map((r) => (
          <div key={r.cles.join('-')} className={classeRangee(r)}>
            {r.cles.map((k) => (
              <div key={k} className="min-w-0">{sections[k]}</div>
            ))}
          </div>
        ))}

        {/* Sections fixes, sous les widgets : le premier bloc lu est celui du profil (spec §8). */}
        {/* ── Macro UEMOA : taux BCEAO + change (section fixe) ── */}
        <MacroBanner />

        {/* ── Afrique · vue régionale — section FIXE (hors widgets configurables :
            un layout utilisateur sauvegardé avant son ajout la masquerait) ── */}
        <section aria-label="Indices pan-africains">
          <AfricanIndicesCard
            brvmComposite={(() => {
              const brvmc = indices.find((i) => i.code === 'BRVMC');
              return brvmc
                ? { valeur: (brvmc.valeur as number | null) ?? null, variation_pct: brvmc.variation_pct ?? null }
                : null;
            })()}
          />
        </section>

        {/* ── Signaux intraday — section FIXE ── */}
        <section aria-label="Signaux intraday patterns">
          <p className="overline text-muted mb-4 tracking-[0.16em]">Patterns intraday</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="md:col-span-1 lg:col-span-2">
              {isPremium ? (
                <IntraDaySignalsWidget />
              ) : (
                <PremiumLock
                  title="Signaux intraday réservés au premium"
                  pitch="Momentum et volumes anormaux détectés en séance, mis à jour toutes les 15 min."
                  rows={4}
                />
              )}
            </div>
            <div className="md:col-span-1 lg:col-span-1">
              {isPremium ? (
                <PatternSummaryWidget />
              ) : (
                <PremiumLock title="Synthèse des motifs" pitch="Réservée au premium." rows={3} />
              )}
            </div>
            {/* Le panneau explicatif reste TOUJOURS visible : il dit à l'utilisateur
                gratuit ce dont il se prive, ce qui est le but du verrou. */}
            <div className="md:col-span-2 lg:col-span-1 flex flex-col gap-3 text-xs text-muted p-4 bg-elevated/20 rounded-xl border border-border/40">
              <p className="font-semibold text-ivory">À propos des patterns</p>
              <p>Adaptés au marché de <strong>fixing</strong> de la BRVM (une fixation par séance) :</p>
              <ul className="space-y-1.5 ml-2">
                <li><strong>Momentum</strong> — Tendance intraséance marquée</li>
                <li><strong>Volume anormal</strong> — Pic d&apos;échanges vs moyenne 20&nbsp;j</li>
                <li>➡️ <strong>Mouvement</strong> — Variation de prix significative</li>
              </ul>
              <p className="pt-2 italic text-faint">
                Volatilité intraday (ATR, consolidation) non pertinente sur un marché de fixing.
                Mis à jour toutes les 15&nbsp;min en séance.
              </p>
            </div>
          </div>
        </section>

        {/* ── Pied de page premium ───────────────────────────────────────── */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-6">
          <p className="text-xs text-faint">
            Dernière mise à jour :{' '}
            <span className="tabular text-muted">{dateLabel}</span>
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs text-faint hover:text-gold transition-colors duration-200"
            >
              Actualiser
            </Link>
            <Link
              href="/parametres/compte"
              className="text-xs text-faint hover:text-gold transition-colors duration-200"
            >
              Paramètres
            </Link>
          </div>
        </footer>

      </div>
    </div>
  );
}
