import { getBacktestingData } from '@/lib/premium/backtesting';
import { BacktestingTables } from '@/components/premium/BacktestingTables';
import {
  SectionHeader,
  PremiumPanel,
  MetricCard,
  StatPill,
} from '@/components/ui/premium';

export default async function BacktestingPremiumPage() {
  const data = await getBacktestingData();

  const nbActions = data.topPlusValues.length;
  const bestPv   = data.topPlusValuesPct[0];
  const bestDiv  = data.topDividendesTotal[0];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <SectionHeader
        kicker="Analyse historique"
        title="Backtesting"
        subtitle="Classement des meilleures performances et dividendes historiques sur la BRVM."
        actions={<StatPill tone="gold">✦ Premium</StatPill>}
      />

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Actions analysées"
          value={String(nbActions)}
          unit="instruments"
          accent="neutral"
        />
        {bestPv ? (
          <MetricCard
            label="Meilleure performance"
            value={`+${bestPv.performance_pct.toFixed(1)}%`}
            delta={`${bestPv.code} — ${bestPv.designation}`}
            deltaDir="up"
            accent="emerald"
          />
        ) : (
          <MetricCard label="Meilleure performance" value="—" accent="neutral" />
        )}
        {bestDiv ? (
          <MetricCard
            label="Meilleur payeur dividendes"
            value={bestDiv.code}
            delta={`${bestDiv.total_divs.toLocaleString('fr-FR')} FCFA cumulés`}
            deltaDir="flat"
            accent="gold"
          />
        ) : (
          <MetricCard label="Meilleur payeur dividendes" value="—" accent="neutral" />
        )}
      </div>

      {/* ── Bandeau édito ─────────────────────────────────────────────────── */}
      <div className="gold-rule flex items-center gap-4">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gold/60">
          Classements détaillés
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-gold/20 to-transparent" />
      </div>

      {/* ── Tables (client component) ─────────────────────────────────────── */}
      <PremiumPanel glow className="p-5">
        <BacktestingTables data={data} />
      </PremiumPanel>

    </div>
  );
}
