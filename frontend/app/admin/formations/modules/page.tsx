import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard } from '@/components/ui/premium';
import { loadAdminModules } from '@/lib/admin/videoModules';
import { ModulesAdmin } from '@/components/admin/ModulesAdmin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Modules vidéo — Administration' };

export default async function Page() {
  await requirePermission('content.read');
  const courses = await loadAdminModules();
  const nbLessons = courses.reduce((n, c) => n + c.lessons.length, 0);
  const nbPub = courses.filter((c) => c.published).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/admin/formations" className="text-muted transition-colors hover:text-ivory">Formations</Link>
        <span className="text-faint">/</span>
        <span className="text-ivory">Modules vidéo</span>
      </div>

      <SectionHeader
        kicker="Académie"
        title="Modules vidéo interactifs"
        subtitle="Créez des cours en vidéo. Collez simplement le lien YouTube/Vimeo (ou une URL .mp4) — l'identifiant est extrait automatiquement."
      />
      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        <MetricCard label="Cours" value={String(courses.length)} />
        <MetricCard label="Publiés" value={String(nbPub)} />
        <MetricCard label="Leçons" value={String(nbLessons)} />
      </div>

      <ModulesAdmin courses={courses} />
    </div>
  );
}
