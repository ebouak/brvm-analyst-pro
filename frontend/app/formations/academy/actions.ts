'use server';

import { createClient } from '@/lib/supabase/server';
import { loadExercise } from '@/lib/academy/exercisesServer';
import { withinTolerance } from '@/lib/academy/exercises';

/**
 * Actions du shell Academy. RLS OWNER : chaque upsert fixe user_id = auth.uid()
 * explicitement ; la policy le vérifie côté base.
 */

type Result = { ok: boolean };

async function upsertProgress(
  courseId: string,
  lessonIdx: number,
  patch: Record<string, unknown>,
): Promise<Result> {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await db.from('academy_progress').upsert(
    {
      user_id: user.id,
      course_id: courseId,
      lesson_idx: lessonIdx,
      updated_at: new Date().toISOString(),
      ...patch,
    },
    { onConflict: 'user_id,course_id,lesson_idx' },
  );
  return { ok: !error };
}

/** Marque une leçon terminée. */
export async function markLessonDone(courseId: string, lessonIdx: number): Promise<Result> {
  return upsertProgress(courseId, lessonIdx, { completed: true });
}

/** Enregistre le résultat du QCM (une question par leçon : 100 ou 0). */
export async function saveQuizResult(
  courseId: string,
  lessonIdx: number,
  correct: boolean,
): Promise<Result> {
  return upsertProgress(courseId, lessonIdx, {
    quiz_score: correct ? 100 : 0,
    quiz_passed: correct,
  });
}

export interface ExerciseCheck {
  ok: boolean;
  correct?: boolean;
  /** Corrigé lisible (ex. « 7,7 » ou l'option correcte). */
  attendu?: string;
  explication?: string;
}

/**
 * Corrige un exercice live : recharge les MÊMES données côté serveur, compare
 * avec tolérance, enregistre le résultat (exercice_passed).
 */
export async function checkExercise(
  courseId: string,
  lessonIdx: number,
  exerciseId: string,
  answer: number,
): Promise<ExerciseCheck> {
  const built = await loadExercise(exerciseId);
  if (!built) return { ok: false };

  const correct = built.pub.type === 'choice'
    ? Math.round(answer) === built.expected
    : withinTolerance(answer, built.expected, built.tolerancePct);

  await upsertProgress(courseId, lessonIdx, { exercice_passed: correct });

  const attendu = built.pub.type === 'choice'
    ? built.pub.options?.[built.expected] ?? String(built.expected)
    : `${built.expected.toFixed(2)}${built.pub.unite ? ` ${built.pub.unite}` : ''}`;

  return { ok: true, correct, attendu, explication: built.explication };
}

/** Sauvegarde la note personnelle (vide → suppression de la ligne). */
export async function saveNote(
  courseId: string,
  lessonIdx: number,
  note: string,
): Promise<Result> {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false };

  if (!note.trim()) {
    const { error } = await db.from('academy_notes').delete()
      .eq('user_id', user.id).eq('course_id', courseId).eq('lesson_idx', lessonIdx);
    return { ok: !error };
  }
  const { error } = await db.from('academy_notes').upsert(
    {
      user_id: user.id,
      course_id: courseId,
      lesson_idx: lessonIdx,
      note: note.slice(0, 5000),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,course_id,lesson_idx' },
  );
  return { ok: !error };
}
