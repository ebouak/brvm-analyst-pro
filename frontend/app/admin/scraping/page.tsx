import IntraDayMonitoringDashboard from '@/components/admin/IntraDayMonitoringDashboard';
import { loadIntraDayMonitoring } from '@/lib/admin/intraday-monitoring';
import { loadCronHealth } from '@/lib/admin/cronHealth';
import { CronHealthPanel } from '@/components/admin/CronHealthPanel';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader } from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Monitoring — Scraping & tâches planifiées' };

export default async function Page() {
  await requirePermission('scraping.read');
  const [dashboard, cronJobs] = await Promise.all([loadIntraDayMonitoring(), loadCronHealth()]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        kicker="Administration"
        title="Monitoring"
        subtitle="Tâches planifiées côté base de données et détection de patterns intraday."
      />
      <div className="gold-rule" />

      {/* En premier : c'est la moitié du système qui était invisible. */}
      <CronHealthPanel jobs={cronJobs} />

      <IntraDayMonitoringDashboard {...dashboard} />
    </div>
  );
}
