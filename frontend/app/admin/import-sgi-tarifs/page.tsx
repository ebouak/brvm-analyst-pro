import { requirePermission } from '@/lib/server/rbac';
import ImportSgiTarifsClient from './ImportSgiTarifsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Import tarifs SGI — Administration' };

export default async function ImportSgiTarifsPage() {
  await requirePermission('content.write');
  return <ImportSgiTarifsClient />;
}
