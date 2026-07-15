import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { SectionHeader } from '@/components/ui/premium';
import { CitablePageForm } from '../CitablePageForm';
import type { CitableInput } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Éditer l’analyse — Administration' };

// La route liste /admin/analyses/nouvelle passe ici via [slug]='nouvelle' ? Non :
// Next donne priorité au segment statique /nouvelle. Ce [slug] ne capte donc que
// les vrais slugs de pages existantes.
export default async function EditAnalysePage({ params }: { params: { slug: string } }) {
  await requirePermission('content.write');
  const db = getServiceClient();
  const { data } = await db.from('citable_pages').select('*').eq('slug', params.slug).maybeSingle();
  if (!data) notFound();

  const initial = data as unknown as CitableInput;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <Link href="/admin/analyses" className="text-sm text-muted hover:text-ivory">← Analyses</Link>
        <Link href={`/analyses/${params.slug}`} target="_blank" className="text-xs text-accent hover:underline">
          Voir la page publique ↗
        </Link>
      </div>
      <SectionHeader kicker="Administration" title={initial.title} subtitle={`/analyses/${params.slug}`} />
      <CitablePageForm initial={initial} />
    </div>
  );
}
