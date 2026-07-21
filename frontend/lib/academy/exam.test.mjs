import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleExam, gradeExam } from './exam.ts';

/** Banque jouet : n questions à 3 options, bonne réponse = index 0 ("bon..."). */
function banque(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i}`, question: `Q${i}`, options: [`bon${i}`, `faux${i}a`, `faux${i}b`], correct: 0, explication: `e${i}`,
  }));
}

test('assembleExam tire `taille` questions sans doublon', () => {
  const ex = assembleExam(banque(40), 'seed-1', 20);
  assert.equal(ex.questions.length, 20);
  assert.equal(new Set(ex.question_ids).size, 20);
});

test('assembleExam est déterministe par seed', () => {
  const a = assembleExam(banque(40), 'seed-1', 20);
  const b = assembleExam(banque(40), 'seed-1', 20);
  assert.deepEqual(a.question_ids, b.question_ids);
  const c = assembleExam(banque(40), 'seed-2', 20);
  assert.notDeepEqual(a.question_ids, c.question_ids);
});

test('assembleExam ne renvoie jamais le champ correct', () => {
  const ex = assembleExam(banque(10), 's', 5);
  for (const q of ex.questions) assert.equal('correct' in q, false);
});

test('assembleExam garde les options intactes (juste réordonnées)', () => {
  const ex = assembleExam(banque(10), 's', 5);
  for (const q of ex.questions) assert.equal(q.options.length, 3);
});

test('taille > banque → toute la banque', () => {
  const ex = assembleExam(banque(5), 's', 20);
  assert.equal(ex.questions.length, 5);
});

test('gradeExam : score et seuil 70 (correction par valeur)', () => {
  const b = banque(10);
  const ex = assembleExam(b, 's', 10);
  const answers = ex.questions.map((q) => ({ id: q.id, options: q.options, choix: q.options.findIndex((o) => o.startsWith('bon')) }));
  assert.equal(gradeExam(b, answers).score, 100);
  assert.equal(gradeExam(b, answers).passed, true);
  const six = answers.map((a, i) => (i < 6 ? a : { ...a, choix: (a.choix + 1) % 3 }));
  assert.equal(gradeExam(b, six).score, 60);
  assert.equal(gradeExam(b, six).passed, false);
  const seven = answers.map((a, i) => (i < 7 ? a : { ...a, choix: (a.choix + 1) % 3 }));
  assert.equal(gradeExam(b, seven).score, 70);
  assert.equal(gradeExam(b, seven).passed, true);
});
