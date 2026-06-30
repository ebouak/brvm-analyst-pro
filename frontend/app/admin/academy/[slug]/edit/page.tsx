import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader } from '@/components/ui/premium';
import { getCourseContent } from '@/lib/academy/server';
import { EditCourseForm } from './EditCourseForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Éditer un cours — Administration' };

export default async function Page({ params }: { params: { slug: string } }) {
  await requirePermission('content.write');
  const content = await getCourseContent(params.slug);
  if (!content) notFound();

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Académie · IA"
        title="Éditer le cours"
        subtitle="Corrigez le contenu manuellement. L'enregistrement re-rend la page sans rappeler l'IA."
      />
      <EditCourseForm slug={params.slug} initial={content} />
    </div>
  );
}
