import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard } from '@/components/ui/premium';
import { loadAdminFormations } from '@/lib/admin/formations';
import { FormationsAdmin } from './FormationsAdmin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Formations — Administration' };

export default async function Page() {
  await requirePermission('content.read');
  const { rows, kpis } = await loadAdminFormations();

  return (
    <div className="space-y-6">
      <SectionHeader kicker="Académie" title="Formations & conférences"
        subtitle="Créez et publiez les contenus de l'espace Premium /formations." />
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <MetricCard label="Total" value={String(kpis.total)} />
        <MetricCard label="Publiées" value={String(kpis.published)} />
      </div>
      <FormationsAdmin rows={rows} />
    </div>
  );
}
