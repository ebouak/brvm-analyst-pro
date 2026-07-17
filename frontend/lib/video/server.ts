import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Couche données des modules vidéo interactifs (formations).
 * Lecture via le client SSR (session utilisateur → RLS authenticated).
 */

export interface VideoCourseCard {
  slug: string;
  titre: string;
  resume: string | null;
  niveau: string | null;
  cover_url: string | null;
  nbLecons: number;
  nbTerminees: number;
}

export interface VideoQuiz {
  id: string;
  at_second: number;
  question: string;
  options: string[];
  correct_idx: number;
  explication: string | null;
}

export interface VideoChapter {
  at_s: number;
  titre: string;
}

export interface VideoLesson {
  id: string;
  titre: string;
  provider: 'mp4' | 'youtube' | 'vimeo';
  video_url: string;
  duree_s: number | null;
  ordre: number;
  transcript: string | null;
  chapters: VideoChapter[];
  quizzes: VideoQuiz[];
  completed: boolean;
  last_second: number;
}

export interface CourseDetail {
  slug: string;
  titre: string;
  resume: string | null;
  niveau: string | null;
  lessons: VideoLesson[];
}

/** Cours publiés + progression de l'utilisateur (compte de leçons terminées). */
export async function listCourses(): Promise<VideoCourseCard[]> {
  const db = createClient();
  const { data: courses } = await db
    .from('video_courses')
    .select('id, slug, titre, resume, niveau, cover_url, ordre')
    .eq('published', true)
    .order('ordre', { ascending: true });
  if (!courses?.length) return [];

  const ids = courses.map((c) => c.id as string);
  const [{ data: lessons }, { data: progress }] = await Promise.all([
    db.from('video_lessons').select('id, course_id').in('course_id', ids),
    db.from('video_progress').select('lesson_id, completed'),
  ]);

  const lessonsByCourse = new Map<string, string[]>();
  for (const l of (lessons ?? []) as { id: string; course_id: string }[]) {
    if (!lessonsByCourse.has(l.course_id)) lessonsByCourse.set(l.course_id, []);
    lessonsByCourse.get(l.course_id)!.push(l.id);
  }
  const done = new Set(
    ((progress ?? []) as { lesson_id: string; completed: boolean }[])
      .filter((p) => p.completed)
      .map((p) => p.lesson_id),
  );

  return courses.map((c) => {
    const ls = lessonsByCourse.get(c.id as string) ?? [];
    return {
      slug: c.slug as string,
      titre: c.titre as string,
      resume: c.resume as string | null,
      niveau: c.niveau as string | null,
      cover_url: c.cover_url as string | null,
      nbLecons: ls.length,
      nbTerminees: ls.filter((id) => done.has(id)).length,
    };
  });
}

/** Un cours complet : leçons + quiz + progression de l'utilisateur. */
export async function getCourse(slug: string): Promise<CourseDetail | null> {
  const db = createClient();
  const { data: course } = await db
    .from('video_courses')
    .select('id, slug, titre, resume, niveau')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (!course) return null;

  const { data: lessons } = await db
    .from('video_lessons')
    .select('id, titre, provider, video_url, duree_s, ordre, transcript, chapters')
    .eq('course_id', course.id)
    .order('ordre', { ascending: true });
  const lessonRows = (lessons ?? []) as Array<{
    id: string; titre: string; provider: VideoLesson['provider']; video_url: string;
    duree_s: number | null; ordre: number; transcript: string | null; chapters: VideoChapter[];
  }>;
  if (lessonRows.length === 0) {
    return { slug: course.slug, titre: course.titre, resume: course.resume, niveau: course.niveau, lessons: [] };
  }

  const lessonIds = lessonRows.map((l) => l.id);
  const [{ data: quizzes }, { data: progress }] = await Promise.all([
    db.from('video_quizzes')
      .select('id, lesson_id, at_second, question, options, correct_idx, explication, ordre')
      .in('lesson_id', lessonIds)
      .order('ordre', { ascending: true }),
    db.from('video_progress').select('lesson_id, completed, last_second').in('lesson_id', lessonIds),
  ]);

  const quizByLesson = new Map<string, VideoQuiz[]>();
  for (const q of (quizzes ?? []) as Array<VideoQuiz & { lesson_id: string }>) {
    if (!quizByLesson.has(q.lesson_id)) quizByLesson.set(q.lesson_id, []);
    quizByLesson.get(q.lesson_id)!.push({
      id: q.id, at_second: q.at_second, question: q.question,
      options: q.options, correct_idx: q.correct_idx, explication: q.explication,
    });
  }
  const progByLesson = new Map(
    ((progress ?? []) as { lesson_id: string; completed: boolean; last_second: number }[])
      .map((p) => [p.lesson_id, p]),
  );

  return {
    slug: course.slug,
    titre: course.titre,
    resume: course.resume,
    niveau: course.niveau,
    lessons: lessonRows.map((l) => {
      const p = progByLesson.get(l.id);
      return {
        id: l.id, titre: l.titre, provider: l.provider, video_url: l.video_url,
        duree_s: l.duree_s, ordre: l.ordre, transcript: l.transcript,
        chapters: Array.isArray(l.chapters) ? l.chapters : [],
        quizzes: quizByLesson.get(l.id) ?? [],
        completed: p?.completed ?? false,
        last_second: p?.last_second ?? 0,
      };
    }),
  };
}
