import { requirePermission } from '@/lib/server/rbac';
import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requirePermission('content.read');
  return <AdminPlaceholder title="Contenu" description="Actualités, communiqués, bulletins." />;
}
