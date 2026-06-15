import { requirePermission } from '@/lib/server/rbac';
import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requirePermission('billing.read');
  return <AdminPlaceholder title="Paiements" description="Transactions, factures, remboursements, échecs." />;
}
