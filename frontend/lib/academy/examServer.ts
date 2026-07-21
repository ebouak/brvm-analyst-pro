import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { createClient } from '@/lib/supabase/server';
import type { BankQuestion } from './exam';

export type Niveau = 'debutant' | 'intermediaire' | 'avance' | 'expert';
export const NIVEAUX: Niveau[] = ['debutant', 'intermediaire', 'avance', 'expert'];

export function isNiveau(x: string): x is Niveau {
  return (NIVEAUX as string[]).includes(x);
}

/** Charge la banque active d'un niveau (service_role : table non lisible autrement). */
export async function loadBank(niveau: Niveau): Promise<BankQuestion[]> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('academy_exam_questions')
    .select('id, question, options, correct, explication')
    .eq('niveau', niveau)
    .eq('active', true);
  return (data ?? []) as BankQuestion[];
}

/**
 * L'utilisateur a-t-il terminé toutes les leçons du cours de ce niveau ?
 * Compare le nb de leçons du contenu au nb de lignes academy_progress
 * `completed` de l'utilisateur pour ce cours (lecture RLS owner via session).
 */
export async function niveauLessonsDone(niveau: Niveau): Promise<{ ok: boolean; courseId: string | null }> {
  const svc = getServiceClient();
  const { data: course } = await svc
    .from('academy_courses')
    .select('id, content')
    .eq('niveau', niveau)
    .eq('published', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!course) return { ok: false, courseId: null };
  const total = ((course.content as { lessons?: unknown[] })?.lessons ?? []).length;

  const db = createClient();
  const { data: prog } = await db
    .from('academy_progress')
    .select('lesson_idx')
    .eq('course_id', course.id)
    .eq('completed', true);
  const done = new Set((prog ?? []).map((r) => r.lesson_idx as number)).size;
  return { ok: total > 0 && done >= total, courseId: course.id as string };
}
