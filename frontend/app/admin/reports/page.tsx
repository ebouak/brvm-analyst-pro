import { requirePermission } from '@/lib/server/rbac';
import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requirePermission('content.read');
  return <AdminPlaceholder title="Rapports IA" description="Générations, templates, coûts, exports." />;
}
