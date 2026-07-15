import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader } from '@/components/ui/premium';
import { CitablePageForm } from '../CitablePageForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nouvelle analyse — Administration' };

export default async function NewAnalysePage() {
  await requirePermission('content.write');
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <Link href="/admin/analyses" className="text-sm text-muted hover:text-ivory">← Analyses</Link>
      <SectionHeader kicker="Administration" title="Nouvelle analyse" subtitle="Créez une page citable — data auto ou éditoriale." />
      <CitablePageForm />
    </div>
  );
}
