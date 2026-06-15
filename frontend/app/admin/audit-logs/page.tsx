import { requirePermission } from '@/lib/server/rbac';
import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requirePermission('audit.read');
  return <AdminPlaceholder title="Audit logs" description="Journal global, sécurité, actions admin." />;
}
