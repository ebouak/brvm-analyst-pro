import { getAnomaliesData } from '@/lib/premium/anomalies';
import { AnomalieCharts } from '@/components/premium/AnomalieCharts';
import { SectionHeader, StatPill, PremiumPanel, MetricCard, EmptyStatePremium } from '@/components/ui/premium';

export default async function AnomaliesPage() {
  const data = await getAnomaliesData();

  const totalSignaux =
    data.pointsDividendes.length +
    data.pointsLiqVol.length +
    data.pointsValuation.length;

  const buyCount = [
    ...data.pointsDividendes,
    ...data.pointsLiqVol,
    ...data.pointsValuation,
  ].filter((p) => p.signal === 'BUY').length;

  const sellCount = [
    ...data.pointsDividendes,
    ...data.pointsLiqVol,
    ...data.pointsValuation,
  ].filter((p) => p.signal === 'SELL').length;

  const hasData =
    data.pointsDividendes.length > 0 ||
    data.pointsLiqVol.length > 0 ||
    data.heatmapCells.length > 0 ||
    data.pointsValuation.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

      {/* Header */}
      <SectionHeader
        kicker="Détection d'anomalies · Visuels exclusifs"
        title="Anomalies &amp; Opportunités de Marché"
        subtitle="4 analyses visuelles pour identifier les actions hors-norme — dividendes, liquidité, heatmap et valorisation."
        actions={<StatPill tone="gold">✦ Premium</StatPill>}
      />

      <div className="gold-rule" />

      {/* Signal legend + KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Signaux détectés"
          value={String(totalSignaux)}
          unit="instruments"
          accent="gold"
        />
        <MetricCard
          label="Opportunités ACHAT"
          value={String(buyCount)}
          deltaDir="up"
          delta="BUY"
          accent="emerald"
        />
        <MetricCard
          label="Alertes VENTE"
          value={String(sellCount)}
          deltaDir="down"
          delta="SELL"
          accent="neutral"
        />
        <MetricCard
          label="Analyses actives"
          value="4"
          unit="modules"
          accent="sapphire"
        />
      </div>

      {/* Signal key */}
      <div className="flex items-center gap-6 px-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-faint">Légende</span>
        <span className="flex items-center gap-1.5 text-xs text-up">
          <span className="w-2 h-2 rounded-full bg-up inline-block" />
          Achat
        </span>
        <span className="flex items-center gap-1.5 text-xs text-warn">
          <span className="w-2 h-2 rounded-full bg-warn inline-block" />
          Conserver
        </span>
        <span className="flex items-center gap-1.5 text-xs text-down">
          <span className="w-2 h-2 rounded-full bg-down inline-block" />
          Vente
        </span>
      </div>

      {/* Charts container — double-bezel */}
      {hasData ? (
        <div className="rounded-panel border p-1.5 border-gold/20 bg-gold/[0.03]">
          <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-6">
            <AnomalieCharts {...data} />
          </div>
        </div>
      ) : (
        <EmptyStatePremium
          title="Aucune anomalie détectée"
          hint="Les analyses visuelles apparaîtront après collecte des données de marché."
          icon="◈"
        />
      )}

    </div>
  );
}
