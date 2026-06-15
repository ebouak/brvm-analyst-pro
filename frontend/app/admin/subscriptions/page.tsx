import { requirePermission } from '@/lib/server/rbac';
import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requirePermission('subscriptions.read');
  return <AdminPlaceholder title="Abonnements" description="Plans, abonnements actifs, essais, résiliations." />;
}
