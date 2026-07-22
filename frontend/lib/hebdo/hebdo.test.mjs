import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLevels } from './levels.ts';
import { selectHebdo } from './select.ts';

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

function cand(code, variation, volume, avgVolume, base = 100) {
  return {
    code,
    closes: Array.from({ length: 40 }, (_, i) => base + i * (variation >= 0 ? 1 : -1)),
    variationHebdo: variation,
    volume,
    avgVolume20: avgVolume,
  };
}

test('selectHebdo retient au plus 5 valeurs, triées par notabilité', () => {
  const picks = selectHebdo([
    cand('AAAA', 12, 3000, 1000), cand('BBBB', 9, 2500, 1000), cand('CCCC', 7, 1200, 1000),
    cand('DDDD', 5, 1100, 1000), cand('EEEE', 4, 1000, 1000), cand('FFFF', 3, 900, 1000),
    cand('GGGG', -8, 4000, 1000),
  ]);
  assert.ok(picks.length >= 3 && picks.length <= 5);
  assert.ok(picks[0].score >= picks[picks.length - 1].score);
});

test('selectHebdo garantit au moins une baisse si une baisse existe', () => {
  const picks = selectHebdo([
    cand('AAAA', 12, 3000, 1000), cand('BBBB', 11, 2900, 1000), cand('CCCC', 10, 2800, 1000),
    cand('DDDD', 9, 2700, 1000), cand('EEEE', 8, 2600, 1000), cand('ZZZZ', -3, 1100, 1000),
  ]);
  assert.ok(picks.some((p) => p.sens === 'baisse'), 'au moins une baisse attendue');
});

test('selectHebdo ignore un historique trop court', () => {
  const court = { code: 'SHRT', closes: [1, 2, 3], variationHebdo: 20, volume: 9999, avgVolume20: 10 };
  const picks = selectHebdo([court, cand('AAAA', 5, 2000, 1000), cand('BBBB', 4, 1500, 1000), cand('CCCC', 3, 1200, 1000)]);
  assert.ok(!picks.some((p) => p.code === 'SHRT'));
});

test('selectHebdo : volume anormal (≥2×) mentionné dans la raison', () => {
  const picks = selectHebdo([cand('AAAA', 6, 3000, 1000), cand('BBBB', 5, 1100, 1000), cand('CCCC', 4, 1050, 1000)]);
  const a = picks.find((p) => p.code === 'AAAA');
  assert.match(a.raison, /volume/i);
});

test('selectHebdo : aucune valeur exploitable → tableau vide', () => {
  assert.deepEqual(selectHebdo([]), []);
});
