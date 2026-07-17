import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';

/** Vue admin des modules vidéo : tous les cours (publiés ou non) + leurs leçons. */

export interface AdminLesson {
  id: string;
  titre: string;
  provider: 'mp4' | 'youtube' | 'vimeo';
  video_url: string;
  ordre: number;
  duree_s: number | null;
}

export interface AdminCourse {
  id: string;
  slug: string;
  titre: string;
  resume: string | null;
  niveau: string | null;
  published: boolean;
  ordre: number;
  lessons: AdminLesson[];
}

export async function loadAdminModules(): Promise<AdminCourse[]> {
  const sb = getServiceClient();
  const { data: courses } = await sb
    .from('video_courses')
    .select('id, slug, titre, resume, niveau, published, ordre')
    .order('ordre', { ascending: true });
  if (!courses?.length) return [];

  const { data: lessons } = await sb
    .from('video_lessons')
    .select('id, course_id, titre, provider, video_url, ordre, duree_s')
    .in('course_id', courses.map((c) => c.id))
    .order('ordre', { ascending: true });

  const byCourse = new Map<string, AdminLesson[]>();
  for (const l of (lessons ?? []) as (AdminLesson & { course_id: string })[]) {
    if (!byCourse.has(l.course_id)) byCourse.set(l.course_id, []);
    byCourse.get(l.course_id)!.push({
      id: l.id, titre: l.titre, provider: l.provider, video_url: l.video_url,
      ordre: l.ordre, duree_s: l.duree_s,
    });
  }

  return (courses as Omit<AdminCourse, 'lessons'>[]).map((c) => ({
    ...c, lessons: byCourse.get(c.id) ?? [],
  }));
}
