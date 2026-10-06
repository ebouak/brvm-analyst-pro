import { createPublicClient } from '@/lib/supabase/public';
import SignalsTable, { type SignalRow } from '@/components/SignalsTable';
import SignalPerformance from '@/components/SignalPerformance';
import { getBacktestStats, getRecentRealBuySignals } from '@/lib/signals/backtest';
import { fmtDateFR } from '@/lib/format';
import type { ActionDaily, SignalDaily } from '@/lib/types';
import {
  SectionHeader,
  EmptyStatePremium,
  PremiumPanel,
  MetricCard,
  SignalBadge,
  StatPill,
  PremiumCTA,
  Eyebrow,
} from '@/components/ui/premium';

import { canAccess } from '@/lib/server/featureAccess';
import { AccessGate } from '@/components/premium/AccessGate';

// Garde par utilisateur : rendu dynamique (le cache partagé exposerait les signaux).
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Signaux' };

async function getData() {
  const supabase = createPublicClient();

  const { data: lastRow } = await supabase
    .from('signals_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, rows: [] as SignalRow[], changes: [] as { code: string; from: string; to: string }[] };

  const [{ data: signals }, { data: actions }, { data: instruments }] = await Promise.all([
    supabase.from('signals_daily').select('*').eq('date_marche', lastDate),
    supabase
      .from('brvm_actions_daily')
      .select('code, designation, cours_jour, variation_pct, secteur, pays')
      .eq('date_marche', lastDate),
    supabase.from('brvm_instruments').select('code, secteur, pays'),
  ]);

  const actMap: Record<string, ActionDaily & { secteur?: string | null; pays?: string | null }> = {};
  for (const a of (actions ?? []) as ActionDaily[]) actMap[a.code] = a;

  const instrMap: Record<string, { secteur?: string | null; pays?: string | null }> = {};
  for (const i of (instruments ?? []) as { code: string; secteur?: string | null; pays?: string | null }[]) {
    instrMap[i.code] = i;
  }

  const rows: SignalRow[] = ((signals ?? []) as SignalDaily[]).map((s) => {
    const act = actMap[s.code];
    const instr = instrMap[s.code];
    return {
      ...s,
      designation: act?.designation ?? null,
      cours_jour: act?.cours_jour ?? null,
      variation_pct: act?.variation_pct ?? null,
      secteur: instr?.secteur ?? act?.secteur ?? null,
      pays: instr?.pays ?? act?.pays ?? null,
    };
  });

  // Bascules depuis la séance précédente : nouveaux BUY/SELL et signaux éteints.
  let changes: { code: string; from: string; to: string }[] = [];
  const { data: prevDateRow } = await supabase
    .from('signals_daily')
    .select('date_marche')
    .lt('date_marche', lastDate)
    .order('date_marche', { ascending: false })
    .limit(1);
  const prevDate = prevDateRow?.[0]?.date_marche ?? null;
  if (prevDate) {
    const { data: prevSignals } = await supabase
      .from('signals_daily')
      .select('code, signal')
      .eq('date_marche', prevDate);
    const prevMap = new Map(((prevSignals ?? []) as { code: string; signal: string }[]).map((p) => [p.code, p.signal]));
    changes = rows
      .filter((r) => {
        const prev = prevMap.get(r.code);
        return prev != null && prev !== r.signal;
      })
      .map((r) => ({ code: r.code, from: prevMap.get(r.code)!, to: r.signal }))
      // Les bascules impliquant BUY ou SELL d'abord (les actionnables)
      .sort((a, b) => {
        const w = (c: { from: string; to: string }) => (c.to === 'BUY' || c.to === 'SELL' ? 0 : 1);
        return w(a) - w(b);
      });
  }

  return { lastDate, rows, changes };
}

export default async function SignauxPage() {
  // Niveau requis LU EN BASE (feature_flags, editable dans /admin/features).
  // La page ne decide rien : elle demande.
  const gate = await canAccess('signaux');
  if (!gate.allowed) {
    return (
      <AccessGate
        required={gate.required === 'free' ? 'premium' : gate.required}
        feature="Les Signaux"
        hint="Signaux d’achat et de vente notés, avec leur performance historique."
      />
    );
  }

  const [{ lastDate, rows, changes }, backtest, recentReal] = await Promise.all([
    getData(),
    getBacktestStats(),
    getRecentRealBuySignals(),
  ]);

  if (!lastDate) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <SectionHeader
          kicker="BRVM · Moteur de signaux"
          title="Signaux d'opportunité"
          subtitle="Signaux techniques calculés à chaque séance, avec le détail des facteurs qui les composent."
        />
        <div className="mt-10">
          <EmptyStatePremium
            title="Aucun signal généré"
            hint="Les signaux sont recalculés après chaque clôture de séance."
            icon="◈"
          />
        </div>
      </div>
    );
  }

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.signal] = (acc[r.signal] ?? 0) + 1;
    return acc;
  }, {});

  const buyCount  = counts.BUY  ?? 0;
  const holdCount = counts.HOLD ?? 0;
  const sellCount = counts.SELL ?? 0;
  const total     = rows.length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

      {/* ── En-tête de page ─────────────────────────────────────────────── */}
      <SectionHeader
        kicker="BRVM · Moteur de signaux"
        title="Signaux d'opportunité"
        subtitle="Signaux techniques calculés à chaque séance, avec le détail des facteurs qui les composent."
        actions={
          <>
            <StatPill tone="gold">
              Dernière séance scorée&nbsp;<span className="tabular">{fmtDateFR(lastDate)}</span>
            </StatPill>
            <PremiumCTA href="/signaux" variant="ghost">
              Actualiser
            </PremiumCTA>
          </>
        }
      />

      {/* ── Filet doré de séparation ────────────────────────────────────── */}
      <div className="gold-rule" />

      {/* ── Track record : backtest méthode + signaux réels récents ────── */}
      <SignalPerformance backtest={backtest} recentReal={recentReal} />

      {/* ── Métriques KPI ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Titres analysés"
          value={String(total)}
          unit="titres"
          accent="neutral"
        />
        <MetricCard
          label="Signaux ACHAT"
          value={String(buyCount)}
          delta={total > 0 ? `${Math.round((buyCount / total) * 100)} % du marché` : undefined}
          deltaDir="up"
          accent="emerald"
        />
        <MetricCard
          label="Signaux CONSERVER"
          value={String(holdCount)}
          delta={total > 0 ? `${Math.round((holdCount / total) * 100)} % du marché` : undefined}
          deltaDir="flat"
          accent="neutral"
        />
        <MetricCard
          label="Signaux VENTE"
          value={String(sellCount)}
          delta={total > 0 ? `${Math.round((sellCount / total) * 100)} % du marché` : undefined}
          deltaDir="down"
          accent="sapphire"
        />
      </div>

      {/* ── Bascules depuis la séance précédente (les VRAIES nouveautés) ── */}
      {changes.length > 0 && (
        <div className="rounded-xl border border-accent/25 bg-accent/[0.05] px-4 py-3">
          <p className="overline mb-2 text-gold-2">Nouveaux depuis la séance précédente</p>
          <ul className="flex flex-wrap gap-2">
            {changes.map((c) => (
              <li key={c.code}>
                <a
                  href={`/actions/${c.code}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs transition-colors hover:border-accent/40"
                >
                  <span className="font-semibold text-ivory">{c.code}</span>
                  <SignalBadge signal={c.from as 'BUY' | 'HOLD' | 'SELL'} />
                  <span className="text-faint">→</span>
                  <SignalBadge signal={c.to as 'BUY' | 'HOLD' | 'SELL'} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Message pédagogique quand aucun signal d'achat ──────────────── */}
      {total > 0 && buyCount === 0 && (
        <div className="rounded-xl border border-info/25 bg-info/[0.06] px-4 py-3 text-sm text-muted">
          <span className="font-medium text-white">Aucun signal d&apos;achat sur cette séance.</span>{' '}
          Aucun titre ne réunit les conditions d&apos;un signal d&apos;achat. C&apos;est une situation
          courante en phase de marché neutre, pas une anomalie. Les titres classés
          <span className="text-white">Conserver</span> n&apos;ont simplement franchi aucun des deux seuils.
        </div>
      )}

      {/* ── Tableau interactif avec filtres ─────────────────────────────── */}
      <PremiumPanel>
        <SignalsTable rows={rows} />
      </PremiumPanel>

      {/* ── Légende de lecture ──────────────────────────────────────────── */}
      <div className="rounded-card border border-border bg-surface shadow-card p-5 space-y-4">
        <Eyebrow>Comment lire les signaux ?</Eyebrow>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* BUY */}
          <div className="rounded-[calc(0.75rem-2px)] border border-up/15 bg-up/[0.04] px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <SignalBadge signal="BUY" />
            </div>
            <p className="tabular text-sm font-semibold text-ivory">Score &gt; +0,60</p>
            <p className="text-xs text-muted leading-relaxed">
              Les facteurs techniques (variation, volume, RSI, MACD, tendance) penchent nettement à la hausse.
            </p>
          </div>

          {/* HOLD */}
          <div className="rounded-[calc(0.75rem-2px)] border border-warn/15 bg-warn/[0.04] px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <SignalBadge signal="HOLD" />
            </div>
            <p className="tabular text-sm font-semibold text-ivory">−0,60 ≤ Score ≤ +0,60</p>
            <p className="text-xs text-muted leading-relaxed">
              Aucun seuil franchi : les facteurs techniques ne penchent pas assez nettement.
            </p>
          </div>

          {/* SELL */}
          <div className="rounded-[calc(0.75rem-2px)] border border-down/15 bg-down/[0.04] px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <SignalBadge signal="SELL" />
            </div>
            <p className="tabular text-sm font-semibold text-ivory">Score &lt; −0,60</p>
            <p className="text-xs text-muted leading-relaxed">
              Les facteurs techniques penchent nettement à la baisse.
            </p>
          </div>
        </div>

        <div className="border-t border-border/40 pt-3 text-xs text-faint italic leading-relaxed">
          Les signaux sont calculés à partir d'indicateurs techniques et ne constituent
          pas un conseil en investissement. Consultez un conseiller agréé COSUMAF avant toute décision.
        </div>
      </div>
    </div>
  );
}
