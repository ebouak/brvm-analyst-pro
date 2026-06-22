import { createPublicClient } from '@/lib/supabase/public';
import SignalsTable, { type SignalRow } from '@/components/SignalsTable';
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

// Données publiques recalculées après clôture : ISR 5 min (audit 2026-06-12)
export const revalidate = 300;
export const metadata = { title: 'Signaux — WESTBOURSE' };

async function getData() {
  const supabase = createPublicClient();

  const { data: lastRow } = await supabase
    .from('signals_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1);
  const lastDate = lastRow?.[0]?.date_marche ?? null;
  if (!lastDate) return { lastDate: null, rows: [] as SignalRow[] };

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

  return { lastDate, rows };
}

export default async function SignauxPage() {
  const { lastDate, rows } = await getData();

  if (!lastDate) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <SectionHeader
          kicker="BRVM · Moteur de signaux"
          title="Signaux d'opportunité"
          subtitle="Détection assistée d'opportunités d'entrée et de sortie sur le marché actions."
        />
        <div className="mt-10">
          <EmptyStatePremium
            title="Aucun signal généré"
            hint="Les signaux sont calculés automatiquement après chaque clôture de séance."
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
        subtitle="Détection assistée d'opportunités d'entrée et de sortie — scoring multi-facteurs explicable."
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

      {/* ── Message pédagogique quand aucun signal d'achat ──────────────── */}
      {total > 0 && buyCount === 0 && (
        <div className="rounded-xl border border-info/25 bg-info/[0.06] px-4 py-3 text-sm text-muted">
          <span className="font-medium text-white">Aucune opportunité d&apos;achat détectée sur cette séance.</span>{' '}
          Le moteur n&apos;a trouvé aucun titre réunissant les conditions d&apos;un signal d&apos;achat —
          c&apos;est un état de marché normal (phase neutre ou prudente), pas une anomalie. Les titres
          en <span className="text-white">Conserver</span> restent à surveiller pour un futur point d&apos;entrée.
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
            <p className="tabular text-sm font-semibold text-ivory">Score &gt; +0.60</p>
            <p className="text-xs text-muted leading-relaxed">
              Opportunité d'achat détectée — momentum positif et valorisation favorable.
            </p>
          </div>

          {/* HOLD */}
          <div className="rounded-[calc(0.75rem-2px)] border border-warn/15 bg-warn/[0.04] px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <SignalBadge signal="HOLD" />
            </div>
            <p className="tabular text-sm font-semibold text-ivory">−0.60 ≤ Score ≤ +0.60</p>
            <p className="text-xs text-muted leading-relaxed">
              Attente & surveillance — signal insuffisant pour déclencher une action.
            </p>
          </div>

          {/* SELL */}
          <div className="rounded-[calc(0.75rem-2px)] border border-down/15 bg-down/[0.04] px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <SignalBadge signal="SELL" />
            </div>
            <p className="tabular text-sm font-semibold text-ivory">Score &lt; −0.60</p>
            <p className="text-xs text-muted leading-relaxed">
              Opportunité de sortie détectée — dégradation des indicateurs de tendance.
            </p>
          </div>
        </div>

        <div className="border-t border-border/40 pt-3 text-xs text-faint italic leading-relaxed">
          Les signaux sont calculés automatiquement à partir d'indicateurs techniques et ne constituent
          pas un conseil en investissement. Consultez un conseiller agréé COSUMAF avant toute décision.
        </div>
      </div>
    </div>
  );
}
