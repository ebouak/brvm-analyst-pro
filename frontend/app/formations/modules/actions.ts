'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Enregistre la progression d'une leçon pour l'utilisateur courant.
 * RLS OWNER : la policy exige user_id = auth.uid() — on le fixe explicitement.
 */
export async function saveLessonProgress(
  lessonId: string,
  input: { lastSecond?: number; completed?: boolean },
): Promise<{ ok: boolean }> {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false };

  const row: Record<string, unknown> = {
    user_id: user.id,
    lesson_id: lessonId,
    updated_at: new Date().toISOString(),
  };
  if (input.lastSecond != null) row.last_second = Math.max(0, Math.round(input.lastSecond));
  if (input.completed != null) {
    row.completed = input.completed;
    row.completed_at = input.completed ? new Date().toISOString() : null;
  }

  const { error } = await db
    .from('video_progress')
    .upsert(row, { onConflict: 'user_id,lesson_id' });

  return { ok: !error };
}
