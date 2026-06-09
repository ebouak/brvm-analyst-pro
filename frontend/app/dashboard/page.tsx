import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import MarketStateCard, { type MarketStats } from '@/components/MarketStateCard';
import DashboardTicker, { type TickerLine } from '@/components/dashboard/DashboardTicker';
import TopMovers from '@/components/TopMovers';
import RecentSignalsCard from '@/components/RecentSignalsCard';
import DailyBrief from '@/components/DailyBrief';
import BriefAssistant from '@/components/dashboard/BriefAssistant';
import WeeklyIndexChart from '@/components/dashboard/WeeklyIndexChart';
import PortfolioComposition from '@/components/dashboard/PortfolioComposition';
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
  if (!lastDate) return { lastDate: null, actions: [], indices: [], signals: [], prevValeur: null, brief: null, ticker: [] as TickerLine[] };

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

  const [{ data: actions }, { data: indices }, { data: signals }, { data: prevActions }, { data: indicesHist }] =
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
            .select('valeur_echangee')
            .eq('date_marche', prevDate)
        : Promise.resolve({ data: [] }),
      supabase
        .from('brvm_indices_daily')
        .select('code, valeur, date_marche')
        .in('code', ['BRVM30', 'BRVMC'])
        .order('date_marche', { ascending: false })
        .limit(14),
    ]);

  const prevValeur = prevDate
    ? ((prevActions ?? []) as ActionDaily[]).reduce((s, a) => s + (a.valeur_echangee ?? 0), 0)
    : null;

  const sparkMap: Record<string, number[]> = {};
  for (const row of ((indicesHist ?? []) as { code: string; valeur: number | null; date_marche: string }[])) {
    if (row.valeur == null) continue;
    (sparkMap[row.code] ??= []).push(row.valeur);
  }
  Object.keys(sparkMap).forEach((k) => sparkMap[k]!.reverse());

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
    sparklines: sparkMap,
    brief,
    ticker,
  };
}

function marketStats(actions: ActionDaily[], prevValeur: number | null): MarketStats {
  let hausses = 0, baisses = 0, stables = 0, volumeTotal = 0, transactions = 0;
  for (const a of actions) {
    const v = a.variation_pct ?? 0;
    if (v > 0) hausses++;
    else if (v < 0) baisses++;
    else stables++;
    volumeTotal += a.valeur_echangee ?? 0;
    transactions += a.nb_transactions ?? 0;
  }
  return { hausses, baisses, stables, total: actions.length, volumeTotal, volumePrev: prevValeur, transactions };
}

export default async function Dashboard() {
  const { lastDate, actions, signals, prevValeur, brief, ticker } = await getData();

  /* ── État vide premium ──────────────────────────────────────────────────── */
  if (!lastDate) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="max-w-7xl mx-auto px-6 py-16 space-y-8">
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
  const withVar = actions.filter((a) => a.variation_pct != null);
  const gainers = [...withVar].sort((a, b) => (b.variation_pct ?? 0) - (a.variation_pct ?? 0)).slice(0, 5);
  const losers  = [...withVar].sort((a, b) => (a.variation_pct ?? 0) - (b.variation_pct ?? 0)).slice(0, 5);

  const dateLabel = new Date(lastDate).toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  const [weekly30, weeklyC] = await Promise.all([
    getWeeklyIndex('BRVM30', 'BRVM 30 — Évolution hebdomadaire'),
    getWeeklyIndex('BRVMC', 'BRVM Composite — Évolution hebdomadaire'),
  ]);

  return (
    <div className="min-h-screen bg-bg">
      {/* ── Halo atmosphérique ────────────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-obsidian-glow"
        aria-hidden
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-10 space-y-8">

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

        {/* ── État du marché (sous le titre) ──────────────────────────────── */}
        <section aria-label="État du marché">
          <p className="overline text-muted mb-4 tracking-[0.16em]">État du marché</p>
          <MarketStateCard stats={stats} />
        </section>

        {/* ── Évolution hebdomadaire (bougies + tendance + RSI/MACD) ──────── */}
        <section aria-label="Évolution hebdomadaire des indices">
          <p className="overline text-muted mb-4 tracking-[0.16em]">Évolution hebdomadaire</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WeeklyIndexChart {...weekly30} />
            <WeeklyIndexChart {...weeklyC} />
          </div>
        </section>

        {/* ── Brief narratif ─────────────────────────────────────────────── */}
        {brief && (
          <section aria-label="Brief de séance">
            <div className="flex items-center justify-between mb-4">
              <p className="overline text-muted tracking-[0.16em]">Brief analytique</p>
              <BriefAssistant />
            </div>
            <DailyBrief brief={brief} />
          </section>
        )}

        {/* ── Bento : Top movers (2 cols) ─────────────────────────────────── */}
        <section aria-label="Meilleurs et pires mouvements">
          <p className="overline text-muted mb-4 tracking-[0.16em]">Mouvements du jour</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TopMovers title="Top 5 hausses" rows={gainers} signals={signals as SignalDaily[]} direction="up" />
            <TopMovers title="Top 5 baisses"  rows={losers}  signals={signals as SignalDaily[]} direction="down" />
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
