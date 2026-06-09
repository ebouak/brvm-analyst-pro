import { getCorrelationsData } from '@/lib/premium/correlations';
import CorrelationsCharts from '@/components/premium/CorrelationsCharts';
import {
  SectionHeader,
  PremiumPanel,
  MetricCard,
  StatPill,
} from '@/components/ui/premium';

export const revalidate = 3600;

export default async function CorrelationsPage() {
  const series = await getCorrelationsData();

  const maxCorr = series.reduce(
    (best, s) => (Math.abs(s.coefficient) > Math.abs(best.coefficient) ? s : best),
    series[0] ?? { label: '—', coefficient: 0 },
  );
  const avgCorr =
    series.length > 0
      ? series.reduce((s, c) => s + Math.abs(c.coefficient), 0) / series.length
      : 0;

  const corrSign = maxCorr.coefficient >= 0 ? '+' : '';

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <SectionHeader
        kicker="Intelligence de marché"
        title="Corrélation Matières Premières"
        subtitle="Relation entre le cours des actions BRVM et les matières premières sous-jacentes — huile de palme, caoutchouc, sucre, cacao."
        actions={<StatPill tone="gold">✦ Premium</StatPill>}
      />

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Secteurs analysés"
          value={String(series.length)}
          delta="filières agro-industrielles BRVM"
          deltaDir="flat"
          accent="sapphire"
        />
        <MetricCard
          label="Plus forte corrélation"
          value={`${corrSign}${maxCorr.coefficient.toFixed(2)}`}
          delta={maxCorr.label?.split('(')[0]?.trim()}
          deltaDir={maxCorr.coefficient >= 0 ? 'up' : 'down'}
          accent="emerald"
        />
        <MetricCard
          label="Corrélation moyenne"
          value={avgCorr.toFixed(2)}
          delta="sur 52 semaines glissantes"
          deltaDir="flat"
          accent="gold"
        />
      </div>

      {/* ── Séparateur éditorial ─────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gold/50">
          Analyse graphique
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ── Graphiques (client component) ────────────────────────────────── */}
      <PremiumPanel glow className="p-5">
        <CorrelationsCharts series={series} />
      </PremiumPanel>

    </div>
  );
}
