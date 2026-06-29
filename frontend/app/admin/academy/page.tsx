import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard } from '@/components/ui/premium';
import { listAllCourses } from '@/lib/academy/server';
import { AcademyAdmin } from './AcademyAdmin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Academy (IA) — Administration' };

export default async function Page() {
  await requirePermission('content.read');
  const courses = await listAllCourses().catch(() => []);
  const published = courses.filter((c) => c.published).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Académie · IA"
        title="Cours générés par IA"
        subtitle="Générez un cours complet (leçons + QCM) par IA, relisez, puis publiez sur /formations/academy."
      />
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <MetricCard label="Total" value={String(courses.length)} />
        <MetricCard label="Publiés" value={String(published)} />
      </div>
      <AcademyAdmin courses={courses} />
    </div>
  );
}
