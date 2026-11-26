import { requirePermission } from '@/lib/server/rbac';
import ImportFondamentauxClient from './ImportFondamentauxClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Import fondamentaux — Administration' };

export default async function ImportFondamentauxPage() {
  await requirePermission('content.write');
  return <ImportFondamentauxClient />;
}
