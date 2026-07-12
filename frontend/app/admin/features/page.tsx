import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { SectionHeader, MetricCard, EmptyStatePremium } from '@/components/ui/premium';
import { FeatureRow, type FlagRow } from './FeatureRow';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fonctionnalités — Administration' };

const nf = new Intl.NumberFormat('fr-FR');

async function load(): Promise<FlagRow[]> {
  const db = getServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: flags }, { data: usage }] = await Promise.all([
    db
      .from('feature_flags')
      .select('code, label, acces, quota_free, quota_premium, description')
      .order('label'),
    db.from('feature_usage').select('feature_code, compteur').eq('jour', today),
  ]);

  const byFeature = new Map<string, number>();
  for (const u of (usage ?? []) as { feature_code: string; compteur: number }[]) {
    byFeature.set(u.feature_code, (byFeature.get(u.feature_code) ?? 0) + u.compteur);
  }

  return ((flags ?? []) as Omit<FlagRow, 'usage_today'>[]).map((f) => ({
    ...f,
    usage_today: byFeature.get(f.code) ?? 0,
  }));
}

export default async function Page() {
  await requirePermission('settings.write');
  const rows = await load();

  const disabled = rows.filter((r) => r.acces === 'disabled').length;
  const usageTotal = rows.reduce((s, r) => s + r.usage_today, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <SectionHeader
        kicker="Administration"
        title="Fonctionnalités"
        subtitle="Ouvrez une fonction à tous, réservez-la aux abonnés, ou coupez-la — sans redéployer. Les quotas journaliers protègent le budget des fonctions coûteuses (LLM)."
      />
      <div className="gold-rule" />

      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Fonctions" value={nf.format(rows.length)} accent="sapphire" />
        <MetricCard
          label="Désactivées"
          value={nf.format(disabled)}
          accent={disabled > 0 ? 'gold' : 'neutral'}
        />
        <MetricCard label="Usages aujourd'hui" value={nf.format(usageTotal)} accent="emerald" />
      </div>

      {rows.length === 0 ? (
        <EmptyStatePremium
          title="Aucune fonctionnalité déclarée"
          hint="Appliquez la migration 0091 pour initialiser le référentiel."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((f) => (
            <FeatureRow key={f.code} f={f} />
          ))}
        </div>
      )}
    </div>
  );
}
