import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseProgress, resumeTarget } from './progressCalc.ts';

/** npx tsx --test lib/academy/progressCalc.test.mjs */

test('aucune progression : 0 %, reprise à la leçon 0', () => {
  const p = courseProgress(5, []);
  assert.deepEqual(p, { done: 0, total: 5, pct: 0, nextIdx: 0 });
});

test('progression partielle : compte, %, prochaine leçon NON terminée', () => {
  const p = courseProgress(5, [
    { lesson_idx: 0, completed: true },
    { lesson_idx: 1, completed: true },
    { lesson_idx: 3, completed: true }, // trou en 2
  ]);
  assert.equal(p.done, 3);
  assert.equal(p.pct, 60);
  assert.equal(p.nextIdx, 2); // la première non terminée, pas la suivante du max
});

test('tout terminé : 100 %, on reste sur la dernière', () => {
  const rows = [0, 1, 2].map((i) => ({ lesson_idx: i, completed: true }));
  const p = courseProgress(3, rows);
  assert.deepEqual(p, { done: 3, total: 3, pct: 100, nextIdx: 2 });
});

test('lignes hors bornes ou non terminées : ignorées du compte', () => {
  const p = courseProgress(2, [
    { lesson_idx: 0, completed: false },
    { lesson_idx: 7, completed: true }, // hors bornes (leçon supprimée)
  ]);
  assert.deepEqual(p, { done: 0, total: 2, pct: 0, nextIdx: 0 });
});

test('cours vide : jamais de division par zéro', () => {
  const p = courseProgress(0, []);
  assert.deepEqual(p, { done: 0, total: 0, pct: 0, nextIdx: 0 });
});

test('resumeTarget : le cours actif le plus récent NON terminé', () => {
  const cards = [
    { id: 'a', slug: 'cours-a', lessonsCount: 3 },
    { id: 'b', slug: 'cours-b', lessonsCount: 2 },
  ];
  const rows = [
    { course_id: 'a', lesson_idx: 0, completed: true, updated_at: '2026-07-01T00:00:00Z' },
    { course_id: 'b', lesson_idx: 0, completed: true, updated_at: '2026-07-10T00:00:00Z' },
  ];
  // b est le plus récent et incomplet (1/2) → reprendre b, leçon 1
  assert.deepEqual(resumeTarget(cards, rows), { slug: 'cours-b', lessonIdx: 1 });
});

test('resumeTarget : un cours 100 % terminé est écarté', () => {
  const cards = [
    { id: 'a', slug: 'cours-a', lessonsCount: 1 },
    { id: 'b', slug: 'cours-b', lessonsCount: 2 },
  ];
  const rows = [
    { course_id: 'a', lesson_idx: 0, completed: true, updated_at: '2026-07-10T00:00:00Z' }, // fini
    { course_id: 'b', lesson_idx: 0, completed: true, updated_at: '2026-07-01T00:00:00Z' },
  ];
  assert.deepEqual(resumeTarget(cards, rows), { slug: 'cours-b', lessonIdx: 1 });
});

test('resumeTarget : aucune progression → null (le hub proposera le 1er cours)', () => {
  assert.equal(resumeTarget([{ id: 'a', slug: 'x', lessonsCount: 3 }], []), null);
});
