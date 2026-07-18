import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { createClient } from '@/lib/supabase/server';
import { courseContentSchema, type CourseContent } from './types';

/**
 * Données du shell d'apprentissage : contenu du cours (service client, publié
 * uniquement) + progression et notes de l'utilisateur (client SSR → RLS owner).
 */

export interface LessonState {
  completed: boolean;
  quizPassed: boolean | null;
}

export interface LearnData {
  courseId: string;
  slug: string;
  content: CourseContent;
  /** Par index de leçon. Absent = jamais ouverte. */
  progress: Record<number, LessonState>;
  /** Notes personnelles par index de leçon. */
  notes: Record<number, string>;
}

export async function loadCourseForLearning(slug: string): Promise<LearnData | null> {
  const svc = getServiceClient();
  const { data: course } = await svc
    .from('academy_courses')
    .select('id, slug, content')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (!course) return null;

  const parsed = courseContentSchema.safeParse(course.content);
  if (!parsed.success) return null; // contenu corrompu → 404 plutôt qu'un crash

  // Lignes utilisateur via la session (RLS owner) — vide si non connecté.
  const db = createClient();
  const [{ data: prog }, { data: notes }] = await Promise.all([
    db.from('academy_progress')
      .select('lesson_idx, completed, quiz_passed')
      .eq('course_id', course.id),
    db.from('academy_notes')
      .select('lesson_idx, note')
      .eq('course_id', course.id),
  ]);

  const progress: Record<number, LessonState> = {};
  for (const r of (prog ?? []) as { lesson_idx: number; completed: boolean; quiz_passed: boolean | null }[]) {
    progress[r.lesson_idx] = { completed: r.completed, quizPassed: r.quiz_passed };
  }
  const notesMap: Record<number, string> = {};
  for (const r of (notes ?? []) as { lesson_idx: number; note: string }[]) {
    notesMap[r.lesson_idx] = r.note;
  }

  return { courseId: course.id, slug: course.slug, content: parsed.data, progress, notes: notesMap };
}
