import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLevels } from './levels.ts';

/** Série croissante 40 → 79 (40 points). */
const croissante = Array.from({ length: 40 }, (_, i) => 40 + i);

test('computeLevels : résistance = plus haut des 20 séances précédentes', () => {
  const l = computeLevels(croissante);
  assert.equal(l.resistance, 78);
  assert.equal(l.cassureHaut, true);
  assert.equal(l.cassureBas, false);
});

test('computeLevels : support = plus bas du canal', () => {
  const l = computeLevels(croissante);
  assert.ok(l.support < l.resistance);
});

test('computeLevels : objectifs au-dessus de la résistance, invalidation sous le support', () => {
  const l = computeLevels(croissante);
  assert.ok(l.objectif1 > l.resistance);
  assert.ok(l.objectif2 > l.objectif1);
  assert.ok(l.invalidation < l.support);
});

test('computeLevels : historique trop court → null', () => {
  assert.equal(computeLevels([1, 2, 3]), null);
});
