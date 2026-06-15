import { requirePermission } from '@/lib/server/rbac';
import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requirePermission('settings.read');
  return <AdminPlaceholder title="Paramètres" description="Plans, pricing, intégrations, email, sécurité." />;
}
