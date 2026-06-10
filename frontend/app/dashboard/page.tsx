import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import MarketStateCard, { type MarketStats } from '@/components/MarketStateCard';
import DashboardTicker, { type TickerLine } from '@/components/dashboard/DashboardTicker';
import TopMovers from '@/components/TopMovers';
import RecentSignalsCard from '@/components/RecentSignalsCard';
import BriefAssistant from '@/components/dashboard/BriefAssistant';
import KeyMetrics from '@/components/dashboard/KeyMetrics';
import WeeklyIndexChart from '@/components/dashboard/WeeklyIndexChart';
import PortfolioComposition from '@/components/dashboard/PortfolioComposition';
import IndexStrip from '@/components/dashboard/IndexStrip';
import { getWeeklyIndex } from '@/lib/dashboard/weeklyIndex';
import { fmtFcfa } from '@/lib/format';
import type { ActionDaily, IndiceDaily, SignalDaily } from '@/lib/types';
import { generateBrief, computeTopSectorPerfs, type Brief } from '@/lib/brief';
import {
  SectionHeader,
  EmptyStatePremium,
  PremiumCTA,
  StatPill,
  PremiumPanel,
} from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard — BRVM Analyst Pro' };

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

  const [{ data: actions }, { data: indices }, { data: signals }, { data: prevActions }] =
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
    ]);

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
    volumePrev: prevValeur,
    topSectorPerfs,
  });

  // Historique cours (10 dernières séances) pour tous les codes — sparklines TopMovers
  const { data: histRows } = await supabase
    .from('brvm_actions_daily')
    .select('code, cours_jour, date_marche')
    .not('cours_jour', 'is', null)
    .order('date_marche', { ascending: false })
    .limit(10 * 47); // max 47 actions × 10 séances

  const sparklines: Record<string, number[]> = {};
  for (const row of (histRows ?? []) as { code: string; cours_jour: number; date_marche: string }[]) {
    (sparklines[row.code] ??= []).push(row.cours_jour);
  }
  // reverse: on a trié desc → on remet chronologique
  for (const k of Object.keys(sparklines)) sparklines[k]!.reverse();

  // Totaux de séance réels (valeur des transactions, capitalisations) — 2 dernières pour le delta
  const { data: summaryRows } = await supabase
    .from('brvm_market_summary')
    .select('date_marche, valeur_transactions, capitalisation_actions, capitalisation_obligations')
    .order('date_marche', { ascending: false })
    .limit(2);
  const summary = (summaryRows?.[0] ?? null) as MarketSummaryRow | null;
  const summaryPrev = (summaryRows?.[1] ?? null) as MarketSummaryRow | null;

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
      .map((a) => ({ code: a.code, value: nfmt(a.cours_jour as number), variation: a.variation_pct ?? null, kind: 'action' as const })),
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
  const { lastDate, actions, indices, signals, prevValeur, prevBreadth, sparklines, summary, summaryPrev, brief, ticker } = await getData();

  /* ── État vide premium ──────────────────────────────────────────────────── */
  if (!lastDate) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
          <SectionHeader
            kicker="Tableau de bord"
            title="Marché BRVM"
            subtitle="Bourse Régionale des Valeurs Mobilières — UEMOA"
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

  const [weekly30, weeklyC] = await Promise.all([
    getWeeklyIndex('BRVM30', 'BRVM 30'),
    getWeeklyIndex('BRVMC', 'BRVM Composite'),
  ]);

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
            <PremiumCTA href="/signaux" variant="ghost">
              Signaux
            </PremiumCTA>
            <PremiumCTA href="/portefeuille" variant="ghost">
              Portefeuille
            </PremiumCTA>
          </nav>
        </header>

        {/* ── Ticker permanent : cours actions + obligations ──────────────── */}
        <DashboardTicker items={ticker} />

        {/* ── Indices BRVM (réels) ────────────────────────────────────────── */}
        <section aria-label="Indices BRVM">
          <IndexStrip indices={indices} />
        </section>

        {/* ── État du marché (sous le titre) ──────────────────────────────── */}
        <section aria-label="État du marché">
          <MarketStateCard stats={stats} sentimentScore={sentimentScore} sentimentDelta={sentimentDelta} breakdown={breakdown} />
        </section>

        {/* ── Rangée principale : 4 colonnes (hausses · baisses · graphiques · brief) ── */}
        <section aria-label="Séance du jour">
          <p className="overline text-muted mb-4 tracking-[0.16em]">Séance du jour</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

            {/* Col 1 — Top hausses */}
            <TopMovers title="Top 5 hausses" rows={gainers} signals={signals as SignalDaily[]} direction="up" sparklines={sparklines} />

            {/* Col 2 — Top baisses */}
            <TopMovers title="Top 5 baisses" rows={losers} signals={signals as SignalDaily[]} direction="down" sparklines={sparklines} />

            {/* Col 3 — Graphiques indices empilés */}
            <div className="space-y-4">
              <WeeklyIndexChart {...weekly30} />
              <WeeklyIndexChart {...weeklyC} />
            </div>

            {/* Col 4 — Brief analytique + repères clés */}
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

        {/* ── Signaux récents ────────────────────────────────────────────── */}
        <section aria-label="Signaux récents">
          <p className="overline text-muted mb-4 tracking-[0.16em]">Signaux actionnables</p>
          <RecentSignalsCard signals={signals as SignalDaily[]} />
        </section>

        {/* ── Composition du portefeuille utilisateur ─────────────────────── */}
        <section aria-label="Composition du portefeuille">
          <p className="overline text-muted mb-4 tracking-[0.16em]">Mon portefeuille</p>
          <PortfolioComposition />
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
