import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTrueReturn } from './trueReturn.ts';

/** npx tsx --test lib/macro/trueReturn.test.mjs */

/** Cas de référence : cours stable, gros dividende — le cas qui piège tout le monde. */
const RENDEMENT_PUR = {
  coursDebut: 1000,
  coursFin: 1000, // le cours n'a PAS bougé
  dividendes: [
    { exercice: 2022, montantBrut: 70, coursReinvest: 1000 },
    { exercice: 2023, montantBrut: 70, coursReinvest: 1000 },
    { exercice: 2024, montantBrut: 70, coursReinvest: 1000 },
  ],
  tauxIrvm: 0.1, // Côte d'Ivoire
  inflations: [4.02, 3.45, 0.13],
};

test('LE CAS QUI COMPTE : cours plat + 7 % de dividende = un BON placement', () => {
  const r = computeTrueReturn(RENDEMENT_PUR);
  assert.ok(r);
  // Ce que toute la place affiche : 0 %. Verdict : « placement médiocre ».
  assert.equal(r.prixSeulPct, 0);
  // La réalité : les dividendes ont fait tout le travail.
  assert.ok(r.totalNominalPct > 19, `attendu > 19 %, reçu ${r.totalNominalPct}`);
  assert.equal(r.apportDividendesPts, r.totalNominalPct); // tout vient du dividende
  // Et même après inflation, l'investisseur s'est ENRICHI.
  assert.ok(r.vraiPct > 11, `attendu > 11 % réel, reçu ${r.vraiPct}`);
  assert.equal(r.perteReelle, false);
});

test('le réinvestissement CAPITALISE : ce n’est pas une simple addition', () => {
  const r = computeTrueReturn(RENDEMENT_PUR);
  assert.ok(r);
  // Addition naïve : 3 × 70 × 0,9 = 189 FCFA sur 1000 → +18,90 %.
  // Réinvesti, chaque dividende rachète des actions qui rapportent à leur tour.
  assert.ok(
    r.totalNominalPct > 18.9,
    `la capitalisation doit dépasser l'addition naïve (18,90 %), reçu ${r.totalNominalPct}`,
  );
  // On détient plus d'une action à la sortie.
  assert.ok(r.actionsFinales > 1.18, `attendu > 1,18 action, reçu ${r.actionsFinales}`);
});

test('l’impôt IRVM du pays change le résultat', () => {
  const togo = computeTrueReturn({ ...RENDEMENT_PUR, tauxIrvm: 0.03 }); // 3 %
  const burkina = computeTrueReturn({ ...RENDEMENT_PUR, tauxIrvm: 0.125 }); // 12,5 %
  assert.ok(togo && burkina);
  // Même titre, même cours, même dividende — le Togolais garde davantage.
  assert.ok(
    togo.vraiPct > burkina.vraiPct,
    `Togo (3 %) doit battre Burkina (12,5 %) : ${togo.vraiPct} vs ${burkina.vraiPct}`,
  );
  assert.ok(togo.impotFcfa < burkina.impotFcfa);
});

test('taux fiscal NON CONFIRMÉ : aucun impôt inventé, et on le signale', () => {
  // Guinée-Bissau et Niger : taux non vérifié dans notre barème.
  const r = computeTrueReturn({ ...RENDEMENT_PUR, tauxIrvm: null });
  assert.ok(r);
  assert.equal(r.impotNonConfirme, true);
  assert.equal(r.impotFcfa, 0);
  // Le chiffre est un MAJORANT : sans impôt, il ne peut qu'être surestimé.
  const ci = computeTrueReturn(RENDEMENT_PUR);
  assert.ok(ci && r.vraiPct > ci.vraiPct);
});

test('un gain nominal peut rester une PERTE réelle', () => {
  const r = computeTrueReturn({
    coursDebut: 1000,
    coursFin: 1010, // +1 %
    dividendes: [{ exercice: 2022, montantBrut: 10, coursReinvest: 1000 }],
    tauxIrvm: 0.1,
    inflations: [9.07], // Niger 2024
  });
  assert.ok(r);
  assert.ok(r.totalNominalPct > 0, 'gain nominal');
  assert.ok(r.vraiPct < 0, 'mais perte réelle');
  assert.equal(r.perteReelle, true);
});

test('AUCUN dividende fourni : on calcule le cours seul, sans inventer de zéro', () => {
  const r = computeTrueReturn({ ...RENDEMENT_PUR, dividendes: [] });
  assert.ok(r);
  assert.equal(r.totalNominalPct, r.prixSeulPct);
  assert.equal(r.apportDividendesPts, 0);
  assert.equal(r.actionsFinales, 1);
});

test('cours de réinvestissement manquant : null, JAMAIS un chiffre approximatif', () => {
  const r = computeTrueReturn({
    ...RENDEMENT_PUR,
    dividendes: [{ exercice: 2022, montantBrut: 70, coursReinvest: 0 }],
  });
  assert.equal(r, null);
});

test('données de base absurdes : null', () => {
  assert.equal(computeTrueReturn({ ...RENDEMENT_PUR, coursDebut: 0 }), null);
  assert.equal(computeTrueReturn({ ...RENDEMENT_PUR, inflations: [] }), null);
});

test('l’ordre des dividendes n’altère pas le résultat (tri chronologique interne)', () => {
  const desordre = computeTrueReturn({
    ...RENDEMENT_PUR,
    dividendes: [...RENDEMENT_PUR.dividendes].reverse(),
  });
  const ordre = computeTrueReturn(RENDEMENT_PUR);
  assert.ok(desordre && ordre);
  assert.equal(desordre.totalNominalPct, ordre.totalNominalPct);
});
