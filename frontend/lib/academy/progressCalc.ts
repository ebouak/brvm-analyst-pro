/**
 * Calculs de progression Academy — fonctions PURES, testées.
 * (progressCalc.test.mjs · npx tsx --test)
 */

export interface ProgressRowLite {
  lesson_idx: number;
  completed: boolean;
}

export interface CourseProgress {
  done: number;
  total: number;
  /** Pourcentage entier 0-100 (0 si cours vide). */
  pct: number;
  /** Leçon à ouvrir : première NON terminée ; dernière si tout est fini. */
  nextIdx: number;
}

export function courseProgress(totalLessons: number, rows: ProgressRowLite[]): CourseProgress {
  const total = Math.max(0, totalLessons);
  const doneSet = new Set<number>();
  for (const r of rows) {
    if (r.completed && r.lesson_idx >= 0 && r.lesson_idx < total) doneSet.add(r.lesson_idx);
  }
  const done = doneSet.size;
  let nextIdx = 0;
  while (nextIdx < total && doneSet.has(nextIdx)) nextIdx++;
  if (total > 0 && nextIdx >= total) nextIdx = total - 1; // tout fini → rester sur la dernière
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100), nextIdx };
}

export interface CourseCardLite {
  id: string;
  slug: string;
  lessonsCount: number;
}

export interface ProgressRowFull extends ProgressRowLite {
  course_id: string;
  updated_at: string;
}

/**
 * Cible « Reprendre » du hub : parmi les cours ENTAMÉS et non terminés, celui
 * dont l'activité est la plus récente ; null si aucune progression.
 */
export function resumeTarget(
  cards: CourseCardLite[],
  rows: ProgressRowFull[],
): { slug: string; lessonIdx: number } | null {
  const byCourse = new Map<string, ProgressRowFull[]>();
  for (const r of rows) {
    if (!byCourse.has(r.course_id)) byCourse.set(r.course_id, []);
    byCourse.get(r.course_id)!.push(r);
  }

  let best: { slug: string; lessonIdx: number; at: number } | null = null;
  for (const c of cards) {
    const cRows = byCourse.get(c.id);
    if (!cRows?.length) continue;
    const p = courseProgress(c.lessonsCount, cRows);
    if (p.total === 0 || p.done >= p.total) continue; // cours fini ou vide → écarté
    const at = Math.max(...cRows.map((r) => Date.parse(r.updated_at) || 0));
    if (!best || at > best.at) best = { slug: c.slug, lessonIdx: p.nextIdx, at };
  }
  return best ? { slug: best.slug, lessonIdx: best.lessonIdx } : null;
}
