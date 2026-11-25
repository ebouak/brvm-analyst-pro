import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  withinTolerance,
  buildPerExercise,
  buildRendementExercise,
  buildTrapChoice,
  buildCapitalisationExercise,
  buildCoutOrdreExercise,
  buildVariationExercise,
  buildPositionMoyenneExercise,
  buildRsiZoneChoice,
  buildEcartIpoExercise,
} from './exercises.ts';

/** npx tsx --test lib/academy/exercises.test.mjs */

test('withinTolerance : ±2 % relatif', () => {
  assert.equal(withinTolerance(10.2, 10.0, 2), true);   // +2 %
  assert.equal(withinTolerance(9.8, 10.0, 2), true);    // −2 %
  assert.equal(withinTolerance(10.3, 10.0, 2), false);  // +3 %
  assert.equal(withinTolerance(0, 0, 2), true);         // zéro exact
  assert.equal(withinTolerance(1, 0, 2), false);        // attendu 0, réponse non nulle
});

/** fr-FR utilise l'espace insécable étroite (U+202F) : comparaison sans espaces. */
const compact = (s) => s.replace(/[\s  ]/g, '');

test('buildPerExercise : énoncé avec les données du jour, attendu = cours/BPA', () => {
  const ex = buildPerExercise({ code: 'SNTS', cours: 31800, bpa: 4136, date: '2026-07-17' });
  assert.equal(ex.pub.id, 'per-du-jour');
  assert.equal(ex.pub.type, 'numeric');
  assert.ok(ex.pub.enonce.includes('SNTS'));
  assert.ok(compact(ex.pub.enonce).includes('31800'));
  assert.ok(compact(ex.pub.enonce).includes('4136'));
  assert.ok(Math.abs(ex.expected - 31800 / 4136) < 0.001);
  assert.equal(ex.tolerancePct, 2);
  assert.equal(ex.pub.asOf, '2026-07-17');
});

test('buildRendementExercise : attendu = dividende/cours en %', () => {
  const ex = buildRendementExercise({ code: 'SNTS', cours: 32000, dividende: 1740, exercice: 2025, date: '2026-07-17' });
  assert.equal(ex.pub.id, 'rendement-net');
  assert.ok(compact(ex.pub.enonce).includes('1740'));
  assert.ok(Math.abs(ex.expected - (1740 / 32000) * 100) < 0.001);
  assert.equal(ex.pub.unite, '%');
});

test('buildTrapChoice : la bonne réponse est le titre en piège', () => {
  const ex = buildTrapChoice([
    { code: 'SNTS', nom: 'SONATEL', per: 7.7, nets: [331_748e6, 393_662e6, 413_588e6] },
    { code: 'PALC', nom: 'PALMCI', per: 8.6, nets: [41_693e6, 19_352e6, 15_862e6, 15_509e6] },
    { code: 'SGBC', nom: 'SGCI', per: 11.7, nets: [30_000e6, 31_000e6, 32_000e6] },
  ]);
  assert.ok(ex, 'un piège doit être détecté');
  assert.equal(ex.pub.type, 'choice');
  assert.equal(ex.pub.options.length, 3);
  assert.equal(ex.expected, 1); // PALC
  assert.ok(ex.pub.options[1].includes('PALMCI'));
});

test('buildTrapChoice : null si aucun piège dans le lot (jamais de faux corrigé)', () => {
  const ex = buildTrapChoice([
    { code: 'A', nom: 'A', per: 9, nets: [10e9, 11e9, 12e9] },
    { code: 'B', nom: 'B', per: 12, nets: [5e9, 5.2e9, 5.4e9] },
  ]);
  assert.equal(ex, null);
});

test('buildCapitalisationExercise : attendu = cours * shares / 1e9', () => {
  const ex = buildCapitalisationExercise({
    code: 'SNTS', nom: 'SONATEL', cours: 30000, shares: 100_000_000, date: '2026-11-24',
  });
  assert.equal(ex.pub.id, 'capitalisation-du-jour');
  assert.equal(ex.pub.unite, 'Md FCFA');
  assert.equal(ex.expected, 3000);
});

test('buildCoutOrdreExercise : applique le max(proportionnel, minimum)', () => {
  const exProp = buildCoutOrdreExercise({
    code: 'SNTS', cours: 30000, quantite: 10, tauxPct: 1.5, minimumFcfa: 2500, date: '2026-11-24',
  });
  assert.equal(exProp.expected, 304500);
  const exMin = buildCoutOrdreExercise({
    code: 'ETIT', cours: 20, quantite: 100, tauxPct: 1.5, minimumFcfa: 2500, date: '2026-11-24',
  });
  assert.equal(exMin.expected, 4500);
});

test('buildVariationExercise : variation signée en % sur 20 séances', () => {
  const ex = buildVariationExercise({
    code: 'SGBC', nom: 'SGCI', coursInitial: 20000, dateInitiale: '2026-10-20', coursFinal: 22000, dateFinale: '2026-11-24',
  });
  assert.equal(ex.pub.id, 'variation-20-seances');
  assert.ok(Math.abs(ex.expected - 10) < 0.001);
});

test('buildPositionMoyenneExercise : écart relatif cours vs MM20', () => {
  const ex = buildPositionMoyenneExercise({
    code: 'SNTS', nom: 'SONATEL', cours: 29400, mm20: 30000, date: '2026-11-24',
  });
  assert.equal(ex.pub.id, 'position-moyenne-20');
  assert.ok(Math.abs(ex.expected - (-2)) < 0.001);
});

test('buildRsiZoneChoice : classe survente / neutre / surachat selon 30 et 70', () => {
  assert.equal(buildRsiZoneChoice({ code: 'A', nom: 'A', rsi: 24.5, date: '2026-11-24' }).expected, 0);
  assert.equal(buildRsiZoneChoice({ code: 'A', nom: 'A', rsi: 52.1, date: '2026-11-24' }).expected, 1);
  assert.equal(buildRsiZoneChoice({ code: 'A', nom: 'A', rsi: 76.8, date: '2026-11-24' }).expected, 2);
});

test('buildEcartIpoExercise : écart BBGC vs prix IPO 6 750 FCFA', () => {
  const ex = buildEcartIpoExercise({ cours: 8100, date: '2026-11-24' });
  assert.equal(ex.pub.id, 'ecart-ipo-bbgc');
  assert.ok(Math.abs(ex.expected - 20) < 0.001);
});
