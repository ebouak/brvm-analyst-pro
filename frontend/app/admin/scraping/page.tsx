import IntraDayMonitoringDashboard from '@/components/admin/IntraDayMonitoringDashboard';
import { loadIntraDayMonitoring } from '@/lib/admin/intraday-monitoring';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader } from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Intraday Patterns — Monitoring' };

export default async function Page() {
  await requirePermission('scraping.read');
  const dashboard = await loadIntraDayMonitoring();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Intraday Patterns — Monitoring"
        subtitle="Suivi temps réel des tâches batch de détection de patterns comportementaux intraday."
      />
      <div className="gold-rule" />

      <IntraDayMonitoringDashboard {...dashboard} />
    </div>
  );
}
