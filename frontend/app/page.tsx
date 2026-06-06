import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import IndexCard from '@/components/IndexCard';
import MarketStateCard, { type MarketStats } from '@/components/MarketStateCard';
import TopMovers from '@/components/TopMovers';
import RecentSignalsCard from '@/components/RecentSignalsCard';
import DailyBrief from '@/components/DailyBrief';
import BriefAssistant from '@/components/dashboard/BriefAssistant';
import { fmtFcfa } from '@/lib/format';
import type { ActionDaily, IndiceDaily, SignalDaily } from '@/lib/types';
import { generateBrief, computeTopSectorPerfs, type Brief } from '@/lib/brief';

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
  if (!lastDate) return { lastDate: null, actions: [], indices: [], signals: [], prevValeur: null, brief: null };

  // Date précédente pour le delta volume
  const { data: prevDateRow } = await supabase
    .from('brvm_actions_daily')
    .select('date_marche')
    .lt('date_marche', lastDate)
    .order('date_marche', { ascending: false })
    .limit(1);
  const prevDate = prevDateRow?.[0]?.date_marche ?? null;

  // Les indices ne sont pas toujours scrapés à la même date que les cours.
  // On prend leur PROPRE dernière date disponible (sinon le bloc reste vide).
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
      // Sparkline 7 dernières séances pour les 2 indices
      supabase
        .from('brvm_indices_daily')
        .select('code, valeur, date_marche')
        .in('code', ['BRVM30', 'BRVMC'])
        .order('date_marche', { ascending: false })
        .limit(14), // 7 par indice
    ]);

  const prevValeur = prevDate
    ? ((prevActions ?? []) as ActionDaily[]).reduce((s, a) => s + (a.valeur_echangee ?? 0), 0)
    : null;

  // Sparklines : dernières 7 valeurs par indice (oldest→newest)
  const sparkMap: Record<string, number[]> = {};
  for (const row of ((indicesHist ?? []) as { code: string; valeur: number | null; date_marche: string }[])) {
    if (row.valeur == null) continue;
    (sparkMap[row.code] ??= []).push(row.valeur);
  }
  // Les rows sont desc (newest first) → inverser pour avoir oldest→newest
  Object.keys(sparkMap).forEach((k) => sparkMap[k]!.reverse());

  const typedActions = (actions ?? []) as ActionDaily[];
  const typedIndices = (indices ?? []) as IndiceDaily[];
  const typedSignals = (signals ?? []) as SignalDaily[];

  // Brief narratif
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

  return {
    lastDate,
    actions: typedActions,
    indices: typedIndices,
    signals: typedSignals,
    prevValeur,
    sparklines: sparkMap,
    brief,
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
  const { lastDate, actions, indices, signals, prevValeur, sparklines, brief } = await getData();

  if (!lastDate) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">📊 Dashboard</h1>
        <div className="bg-surface border border-border rounded-xl p-10 text-center space-y-3">
          <p className="text-muted">Aucune donnée de marché disponible.</p>
          <p className="text-xs text-muted">
            Lancez <code className="text-up bg-up/10 px-1 rounded">npm run scrape:daily</code> côté scraper pour alimenter la base.
          </p>
          <Link href="/actions" className="inline-block mt-2 text-xs text-up border border-up/30 rounded px-3 py-1.5 hover:bg-up/10">
            Actualiser
          </Link>
        </div>
      </div>
    );
  }

  const stats = marketStats(actions, prevValeur);
  const withVar = actions.filter((a) => a.variation_pct != null);
  const gainers = [...withVar].sort((a, b) => (b.variation_pct ?? 0) - (a.variation_pct ?? 0)).slice(0, 5);
  const losers  = [...withVar].sort((a, b) => (a.variation_pct ?? 0) - (b.variation_pct ?? 0)).slice(0, 5);
  const brvm30  = indices.find((i) => i.code === 'BRVM30');
  const brvmc   = indices.find((i) => i.code === 'BRVMC');

  // Volume total pour les indices
  const volTotal = actions.reduce((s, a) => s + (a.valeur_echangee ?? 0), 0);
  const dateLabel = new Date(lastDate).toLocaleDateString('fr-FR', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* ── En-tête ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">📊 Dashboard</h1>
          <p className="text-xs text-muted mt-0.5">Séance du {dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/signaux" className="text-xs border border-border rounded px-2 py-1 text-muted hover:text-white hover:border-up/40 transition">
            🔔 Signaux
          </Link>
          <Link href="/portefeuille" className="text-xs border border-border rounded px-2 py-1 text-muted hover:text-white hover:border-up/40 transition">
            👤 Portefeuille
          </Link>
        </div>
      </div>

      {/* ── Indices ── */}
      <div className="grid grid-cols-2 gap-4">
        <IndexCard
          code="BRVM30"
          label="BRVM 30"
          valeur={brvm30?.valeur ?? null}
          variation_pct={brvm30?.variation_pct ?? null}
          valeur_echangee={volTotal / 2}
          date_seance={lastDate}
          sparkline={sparklines?.['BRVM30']}
        />
        <IndexCard
          code="BRVMC"
          label="BRVM Composite"
          valeur={brvmc?.valeur ?? null}
          variation_pct={brvmc?.variation_pct ?? null}
          valeur_echangee={volTotal}
          date_seance={lastDate}
          sparkline={sparklines?.['BRVMC']}
        />
      </div>

      {/* ── Brief narratif ── */}
      {brief && (
        <div className="relative">
          <DailyBrief brief={brief} />
          <div className="absolute top-4 right-4"><BriefAssistant /></div>
        </div>
      )}

      {/* ── État du marché ── */}
      <MarketStateCard stats={stats} />

      {/* ── Top movers ── */}
      <div className="grid grid-cols-2 gap-4">
        <TopMovers title="🔥 Top 5 hausses" rows={gainers} signals={signals as SignalDaily[]} />
        <TopMovers title="📉 Top 5 baisses"  rows={losers}  signals={signals as SignalDaily[]} />
      </div>

      {/* ── Signaux récents ── */}
      <RecentSignalsCard signals={signals as SignalDaily[]} />

      {/* ── Pied de page ── */}
      <div className="flex items-center justify-between text-xs text-muted border-t border-border/50 pt-3">
        <span>📅 Dernière mise à jour : {dateLabel}</span>
        <div className="flex gap-3">
          <Link href="/" className="hover:text-up">🔄 Actualiser</Link>
          <Link href="/parametres/compte" className="hover:text-up">⚙️ Paramètres</Link>
        </div>
      </div>
    </div>
  );
}
