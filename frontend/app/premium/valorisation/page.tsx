import { getMarketValuations } from '@/lib/valuation/server';
import { getMarketScoring } from '@/lib/scoring/server';
import ValuationScreener from '@/components/premium/ValuationScreener';
import {
  SectionHeader,
  PremiumPanel,
  MetricCard,
  StatPill,
  EmptyStatePremium,
} from '@/components/ui/premium';
import ViewTabs from '@/components/ViewTabs';
import { VALO_TABS } from '@/lib/viewTabsPresets';

export const revalidate = 3600;
export const metadata = { title: 'Valorisation — WESTBOURSE' };

export default async function ValorisationPage() {
  const [all, scoringMap] = await Promise.all([getMarketValuations(), getMarketScoring()]);
  const scoring = Object.fromEntries(scoringMap);
  const valuable = all.filter((c) => c.metrics.reliable && c.fairValue.upside != null);
  const decotes = valuable.filter((c) => c.verdict.stance === 'decote').length;
  const cheapest = [...valuable].sort((a, b) => (b.fairValue.upside ?? -Infinity) - (a.fairValue.upside ?? -Infinity))[0];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <SectionHeader
        accent="gold"
        kicker="Intelligence fondamentale"
        title="Valorisation BRVM"
        subtitle="Juste-valeur estimée vs cours — multiples sectoriels (P/E, P/B) et DDM. Classement value du marché."
        actions={<StatPill tone="gold">✦ Premium</StatPill>}
      />
      <ViewTabs tabs={VALO_TABS} current="/premium/valorisation" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Sociétés valorisables" value={String(valuable.length)} delta={`sur ${all.length} analysées`} deltaDir="flat" accent="sapphire" />
        <MetricCard label="En décote estimée" value={String(decotes)} delta="potentiel > +15 %" deltaDir="up" accent="emerald" />
        <MetricCard
          label="Plus forte décote"
          value={cheapest ? cheapest.code : '—'}
          delta={cheapest && cheapest.fairValue.upside != null ? `+${(cheapest.fairValue.upside * 100).toFixed(0)} %` : undefined}
          deltaDir="up"
          accent="gold"
        />
      </div>

      {all.length === 0 ? (
        <EmptyStatePremium icon="◎" title="Aucune donnée fondamentale" hint="Les états financiers alimenteront cette analyse." />
      ) : (
        <PremiumPanel glow className="p-5">
          <ValuationScreener data={all} scoring={scoring} />
        </PremiumPanel>
      )}
    </div>
  );
}
