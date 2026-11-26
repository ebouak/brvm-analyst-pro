import { requirePermission } from '@/lib/server/rbac';
import VeilleBRVMClient from './VeilleBRVMClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Veille BRVM — Administration' };

export default async function VeilleBRVMPage() {
  await requirePermission('content.read');
  return <VeilleBRVMClient />;
}
