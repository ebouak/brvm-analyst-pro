import { getClassement, type CritereClassement } from '@/lib/premium/classements';
import { ClassementsTable } from '@/components/premium/ClassementsTable';
import { SectionHeader, StatPill, PremiumPanel, MetricCard, EmptyStatePremium } from '@/components/ui/premium';

const CRITERES: CritereClassement[] = [
  'performance', 'liquidite', 'volatilite', 'valeur_echangee',
  'marge_nette', 'taux_rotation', 'reserve', 'per', 'pbr',
];

export default async function ClassementsPage({
  searchParams,
}: {
  searchParams: { critere?: string };
}) {
  const critereInit = (CRITERES.includes(searchParams.critere as CritereClassement)
    ? searchParams.critere
    : 'performance') as CritereClassement;

  const results = await Promise.all(CRITERES.map((c) => getClassement(c)));
  const data = Object.fromEntries(
    CRITERES.map((c, i) => [c, results[i]!]),
  ) as Record<CritereClassement, Awaited<ReturnType<typeof getClassement>>>;

  const perfRows = data['performance'] ?? [];
  const topPerf = perfRows[0] ?? null;
  const totalSocietes = perfRows.length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

      {/* Header */}
      <SectionHeader
        kicker="Classements · 9 critères analytiques"
        title="Classements des Actions BRVM"
        subtitle="Palmarès de toutes les sociétés cotées selon la performance, la liquidité, la valorisation et les fondamentaux."
        actions={<StatPill tone="gold">✦ Premium</StatPill>}
      />

      <div className="gold-rule" />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Sociétés classées"
          value={String(totalSocietes)}
          unit="entreprises"
          accent="gold"
        />
        <MetricCard
          label="Critères d'analyse"
          value="9"
          unit="dimensions"
          accent="sapphire"
        />
        {topPerf && (
          <MetricCard
            label="N°1 Performance"
            value={topPerf.code}
            delta={topPerf.valeur_label}
            deltaDir="up"
            accent="emerald"
          />
        )}
        <MetricCard
          label="Couverture marché"
          value="BRVM"
          unit="UEMOA"
          accent="neutral"
        />
      </div>

      {/* Table container — double-bezel */}
      <div className="rounded-panel border p-1.5 border-gold/20 bg-gold/[0.03]">
        <div className="rounded-[calc(1.125rem-0.375rem)] bg-surface shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-6">
          {totalSocietes === 0 ? (
            <EmptyStatePremium
              title="Aucune donnée de classement"
              hint="Les données seront disponibles après la prochaine collecte de marché."
              icon="◈"
            />
          ) : (
            <ClassementsTable data={data} critereInit={critereInit} />
          )}
        </div>
      </div>

    </div>
  );
}
