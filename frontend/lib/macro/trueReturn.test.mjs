import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTrueReturn } from './trueReturn.ts';
import { purchasingPower, cumulativeInflation, annualizedInflation } from './realReturn.ts';

/** npx tsx --test lib/macro/trueReturn.test.mjs */

/** Référence : cours stable, dividende NET de 70 (déjà prélevé à la source). */
const REF = {
  coursDebut: 1000,
  coursFin: 1000,
  dividendes: [
    { exercice: 2022, montantNet: 70, coursReinvest: 1000 },
    { exercice: 2023, montantNet: 70, coursReinvest: 1000 },
    { exercice: 2024, montantNet: 70, coursReinvest: 1000 },
  ],
  inflations: [4.02, 3.45, 0.13],
};

test('LE CAS QUI COMPTE : cours plat + 7 % de dividende net = un BON placement', () => {
  const r = computeTrueReturn(REF);
  assert.ok(r);
  assert.equal(r.prixSeulPct, 0); // ce que tout le monde affiche
  assert.ok(r.totalNominalPct > 21, `attendu > 21 %, reçu ${r.totalNominalPct}`);
  assert.equal(r.apportDividendesPts, r.totalNominalPct);
  assert.ok(r.vraiPct > 13, `attendu > 13 % réel, reçu ${r.vraiPct}`);
  assert.equal(r.perteReelle, false);
});

test('le dividende NET n’est PAS re-taxé (pas de double imposition)', () => {
  // 3 × 70 réinvestis sans re-taxation. Addition naïve : 3×70/1000 = +21 %.
  // Capitalisé, ça dépasse un peu 21 %.
  const r = computeTrueReturn(REF);
  assert.ok(r.totalNominalPct > 21, `capitalisation > addition naïve (21 %), reçu ${r.totalNominalPct}`);
  assert.ok(r.actionsFinales > 1.21, `attendu > 1,21 action, reçu ${r.actionsFinales}`);
});

test('la différence entre pays vient de l’INFLATION, pas de l’impôt', () => {
  // Même titre, mêmes dividendes nets. Seule l'inflation diffère.
  const burkina = computeTrueReturn({ ...REF, inflations: [1.0, 1.5, 1.8] }); // faible inflation
  const bissau = computeTrueReturn({ ...REF, inflations: [4.5, 4.0, 3.6] }); // forte inflation
  assert.ok(burkina && bissau);
  // Le nominal est IDENTIQUE (mêmes dividendes nets, même cours).
  assert.equal(burkina.totalNominalPct, bissau.totalNominalPct);
  // Mais le réel diffère : moins d'inflation = plus de pouvoir d'achat.
  assert.ok(burkina.vraiPct > bissau.vraiPct);
});

test('un gain nominal peut rester une PERTE réelle (forte inflation)', () => {
  const r = computeTrueReturn({
    coursDebut: 1000,
    coursFin: 1010,
    dividendes: [{ exercice: 2022, montantNet: 10, coursReinvest: 1000 }],
    inflations: [9.07],
  });
  assert.ok(r);
  assert.ok(r.totalNominalPct > 0, 'gain nominal');
  assert.ok(r.vraiPct < 0, 'mais perte réelle');
  assert.equal(r.perteReelle, true);
});

test('AUCUN dividende : cours seul, sans inventer de zéro', () => {
  const r = computeTrueReturn({ ...REF, dividendes: [] });
  assert.ok(r);
  assert.equal(r.totalNominalPct, r.prixSeulPct);
  assert.equal(r.apportDividendesPts, 0);
  assert.equal(r.actionsFinales, 1);
});

test('cours de réinvestissement manquant : null, jamais un chiffre approximatif', () => {
  const r = computeTrueReturn({
    ...REF,
    dividendes: [{ exercice: 2022, montantNet: 70, coursReinvest: 0 }],
  });
  assert.equal(r, null);
});

test('données de base absurdes : null', () => {
  assert.equal(computeTrueReturn({ ...REF, coursDebut: 0 }), null);
  assert.equal(computeTrueReturn({ ...REF, inflations: [] }), null);
});

test('l’ordre des dividendes n’altère pas le résultat (tri chronologique interne)', () => {
  const desordre = computeTrueReturn({ ...REF, dividendes: [...REF.dividendes].reverse() });
  const ordre = computeTrueReturn(REF);
  assert.ok(desordre && ordre);
  assert.equal(desordre.totalNominalPct, ordre.totalNominalPct);
});

test('utilitaires inflation inchangés', () => {
  assert.equal(cumulativeInflation([9, 1, 3]), 13.39);
  assert.equal(annualizedInflation([9, 1, 3]), 4.28);
  assert.equal(purchasingPower(1_000_000, 2, 5), 1_104_081);
});
