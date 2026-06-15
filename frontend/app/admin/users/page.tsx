import { requirePermission } from '@/lib/server/rbac';
import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requirePermission('users.read');
  return <AdminPlaceholder title="Utilisateurs" description="Liste, fiche utilisateur, accès, historique." />;
}
