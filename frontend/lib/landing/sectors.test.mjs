import assert from 'node:assert/strict';
import test from 'node:test';
import { computeSectorVariations } from './sectors.ts';

const MAP = { AAA: 'Banques', BBB: 'Banques', CCC: 'Télécoms' };

test('agrège par secteur et trie du plus fort au plus faible', () => {
  const r = computeSectorVariations(
    [
      { code: 'AAA', variation_pct: 2, cours_jour: 100, shares: 1 },
      { code: 'CCC', variation_pct: 5, cours_jour: 100, shares: 1 },
    ],
    MAP,
  );
  assert.deepEqual(r.map((s) => s.secteur), ['Télécoms', 'Banques']);
});

test('pondère par la capitalisation, pas par simple moyenne', () => {
  // AAA pèse 9x BBB : la moyenne simple donnerait 5,5 %, la pondérée ~1,4 %.
  const [banques] = computeSectorVariations(
    [
      { code: 'AAA', variation_pct: 1, cours_jour: 100, shares: 90 },
      { code: 'BBB', variation_pct: 10, cours_jour: 100, shares: 10 },
    ],
    MAP,
  );
  assert.equal(banques.nb, 2);
  assert.ok(Math.abs(banques.variation_pct - 1.9) < 0.001, banques.variation_pct);
});

test('un code hors classification est ignoré, jamais rangé dans "Autre"', () => {
  const r = computeSectorVariations([{ code: 'ZZZ', variation_pct: 3, cours_jour: 1, shares: 1 }], MAP);
  assert.deepEqual(r, []);
});

test('une variation nulle ou non finie est écartée', () => {
  const r = computeSectorVariations(
    [
      { code: 'AAA', variation_pct: null, cours_jour: 100, shares: 1 },
      { code: 'BBB', variation_pct: NaN, cours_jour: 100, shares: 1 },
    ],
    MAP,
  );
  assert.deepEqual(r, [], 'aucun secteur ne doit apparaître à 0 % par défaut');
});

test('capitalisation manquante -> le titre compte quand même (poids 1)', () => {
  const [s] = computeSectorVariations(
    [{ code: 'AAA', variation_pct: 4, cours_jour: null, shares: null }],
    MAP,
  );
  assert.equal(s.nb, 1);
  assert.equal(s.variation_pct, 4);
});

test('variations négatives conservent leur signe', () => {
  const [s] = computeSectorVariations(
    [{ code: 'CCC', variation_pct: -2.5, cours_jour: 10, shares: 10 }],
    MAP,
  );
  assert.equal(s.variation_pct, -2.5);
});
