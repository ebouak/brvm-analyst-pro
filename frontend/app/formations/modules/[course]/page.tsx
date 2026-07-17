import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCourse } from '@/lib/video/server';
import CoursePlayer from '@/components/formations/CoursePlayer';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { course: string } }): Promise<Metadata> {
  const course = await getCourse(params.course).catch(() => null);
  return { title: course ? `${course.titre} — Formations` : 'Module introuvable' };
}

export default async function CoursePage({ params }: { params: { course: string } }) {
  const course = await getCourse(params.course).catch(() => null);
  if (!course) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/formations" className="text-muted transition-colors hover:text-white">Formations</Link>
        <span className="text-faint">/</span>
        <Link href="/formations/modules" className="text-muted transition-colors hover:text-white">Modules</Link>
        <span className="text-faint">/</span>
        <span className="text-white">{course.titre}</span>
      </div>

      <div>
        <h1 className="font-display text-2xl text-white">{course.titre}</h1>
        {course.resume && <p className="mt-1 max-w-2xl text-sm text-muted">{course.resume}</p>}
      </div>

      <CoursePlayer course={course} />
    </div>
  );
}
