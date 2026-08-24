import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRatios, latestUsable } from './fundamentals.ts';

const base = { code: 'X', year: 2025, revenue: null, net_income: null, equity: null, debt: null };

test('marge nette et ROE en pourcentage', () => {
  const r = computeRatios({ ...base, revenue: 1000, net_income: 150, equity: 500 });
  assert.equal(r.margeNettePct, 15);
  assert.equal(r.roePct, 30);
});

test('dénominateur manquant -> null, jamais 0', () => {
  const r = computeRatios({ ...base, net_income: 150 });
  assert.equal(r.margeNettePct, null);
  assert.equal(r.roePct, null);
});

test('capitaux propres négatifs -> ROE null (un ROE positif serait trompeur)', () => {
  const r = computeRatios({ ...base, net_income: -50, equity: -200 });
  assert.equal(r.roePct, null);
});

test('gearing est un ratio, pas un pourcentage', () => {
  const r = computeRatios({ ...base, debt: 300, equity: 600 });
  assert.equal(r.gearing, 0.5);
});

test('perte -> marge négative conservée', () => {
  const r = computeRatios({ ...base, revenue: 1000, net_income: -200 });
  assert.equal(r.margeNettePct, -20);
});

test('latestUsable ignore une année vide plus récente', () => {
  const rows = [
    { ...base, year: 2024, revenue: 900, net_income: 100 },
    { ...base, year: 2025 },
  ];
  assert.equal(latestUsable(rows).year, 2024);
});

test('latestUsable renvoie null si rien d’exploitable', () => {
  assert.equal(latestUsable([{ ...base, year: 2025 }]), null);
  assert.equal(latestUsable([]), null);
});
