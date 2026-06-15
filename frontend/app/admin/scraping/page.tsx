import { requirePermission } from '@/lib/server/rbac';
import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requirePermission('scraping.read');
  return <AdminPlaceholder title="Scraping" description="Runs, sources, incidents, qualité des données, cron." />;
}
