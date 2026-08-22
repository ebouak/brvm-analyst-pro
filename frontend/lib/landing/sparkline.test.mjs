import assert from 'node:assert/strict';
import test from 'node:test';
import { sparklinePath } from './sparkline.ts';

test('série trop courte -> null (jamais de trait inventé)', () => {
  assert.equal(sparklinePath([], 60, 20), null);
  assert.equal(sparklinePath([100], 60, 20), null);
});

test('ignore les valeurs non finies', () => {
  assert.equal(sparklinePath([100, NaN], 60, 20), null);
});

test('série plate -> ligne centrée, pas de division par zéro', () => {
  const g = sparklinePath([500, 500, 500], 60, 20);
  assert.ok(g);
  assert.ok(!g.line.includes('NaN'), g.line);
  for (const seg of g.line.replace('M', '').split(' L')) {
    assert.equal(Number(seg.split(',')[1]), 10);
  }
});

test('série croissante -> dernier point plus haut que le premier (y inversé en SVG)', () => {
  const g = sparklinePath([10, 20, 30], 60, 20);
  assert.ok(g);
  const ys = g.line.replace('M', '').split(' L').map((p) => Number(p.split(',')[1]));
  assert.ok(ys[0] > ys[ys.length - 1], `attendu descendant en y, reçu ${ys}`);
});

test("l'aplat referme le tracé sur la ligne de base", () => {
  const g = sparklinePath([1, 2], 60, 20);
  assert.ok(g.area.endsWith('L60.00,20 L0,20 Z'), g.area);
});

test('le tracé occupe toute la largeur demandée', () => {
  const g = sparklinePath([1, 2, 3, 4], 80, 24);
  const xs = g.line.replace('M', '').split(' L').map((p) => Number(p.split(',')[0]));
  assert.equal(xs[0], 0);
  assert.equal(xs[xs.length - 1], 80);
});
