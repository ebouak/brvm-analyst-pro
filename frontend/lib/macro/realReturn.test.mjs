import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  realReturn,
  purchasingPower,
  cumulativeInflation,
  annualizedInflation,
} from './realReturn.ts';

/** npx tsx --test lib/macro/realReturn.test.mjs */

test('Fisher, pas la soustraction : +10 % nominal / 9 % inflation', () => {
  // Niger 2024 : inflation réelle de 9,07 %. La soustraction donnerait +1,00 %.
  const r = realReturn({ nominalPct: 10, inflationPct: 9 });
  assert.equal(r.realPct, 0.92); // 1.10/1.09 - 1
  assert.equal(r.destroysValue, false);
  // L'approximation naïve SURESTIME le gain de 0,08 point.
  assert.equal(r.naiveErrorPts, 0.08);
});

test('un gain nominal peut être une PERTE réelle', () => {
  // +3 % nominal quand l'inflation est à 9 % : on s'appauvrit.
  const r = realReturn({ nominalPct: 3, inflationPct: 9 });
  assert.ok(r.realPct < 0, `attendu négatif, reçu ${r.realPct}`);
  assert.equal(r.destroysValue, true);
});

test('inflation nulle : réel = nominal', () => {
  const r = realReturn({ nominalPct: 7.5, inflationPct: 0 });
  assert.equal(r.realPct, 7.5);
  assert.equal(r.naiveErrorPts, 0);
});

test('déflation : le rendement réel dépasse le nominal', () => {
  const r = realReturn({ nominalPct: 2, inflationPct: -1 });
  assert.ok(r.realPct > 2, `en déflation le réel doit dépasser le nominal (reçu ${r.realPct})`);
});

test('inflation ≤ -100 % : NaN, jamais Infinity', () => {
  // Une donnée corrompue ne doit pas afficher un rendement mirifique.
  const r = realReturn({ nominalPct: 5, inflationPct: -100 });
  assert.ok(Number.isNaN(r.realPct));
});

test('pouvoir d’achat : le concret plutôt que le pourcentage', () => {
  // 1 000 000 FCFA à +2 % réel pendant 5 ans.
  assert.equal(purchasingPower(1_000_000, 2, 5), 1_104_081);
  // Rendement réel négatif → le capital fond en pouvoir d'achat.
  assert.ok(purchasingPower(1_000_000, -5, 5) < 1_000_000);
});

test('inflation cumulée : on chaîne, on ne moyenne pas', () => {
  // 9 % puis 1 % puis 3 % → 1.09 * 1.01 * 1.03 - 1 = 13.39 %
  assert.equal(cumulativeInflation([9, 1, 3]), 13.39);
});

test('inflation annualisée = moyenne GÉOMÉTRIQUE, pas arithmétique', () => {
  const a = annualizedInflation([9, 1, 3]);
  const arithmetique = (9 + 1 + 3) / 3; // 4.33 — la réponse naïve
  assert.ok(a !== null);
  assert.notEqual(a, arithmetique);
  assert.equal(a, 4.28);
});

test('aucune donnée : null, jamais un chiffre inventé', () => {
  assert.equal(cumulativeInflation([]), null);
  assert.equal(annualizedInflation([]), null);
});
