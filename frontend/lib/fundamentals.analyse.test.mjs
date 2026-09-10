import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fusionnerExercices,
  qualiteResultat,
  croissanceCA,
  expliqueDetachement,
} from './fundamentals.ts';

/**
 * Ces règles ne font échouer aucun rendu : un ratio faux s'affiche sans
 * erreur, et un modèle de langage le reprendra tel quel dans une note
 * d'investissement. Seul un test les attrape.
 */

const L = (periode, revenu_total, resultat_exploitation, resultat_avant_impots, resultat_net) => ({
  periode, revenu_total, resultat_exploitation, resultat_avant_impots, resultat_net,
});

// ── Fusion des exercices ────────────────────────────────────────────────────

test('deux lignes du même exercice se complètent au lieu de se remplacer', () => {
  // Cas réel NEIC : l'extraction résumée porte CA et résultat net, le détail
  // porte l'exploitation et l'avant-impôts. Aucune n'est complète seule.
  const f = fusionnerExercices([
    L('2025', 5_139_206_354, null, null, 2_036_626_234),
    L('2025', 5_139_206_354, 1_213_000_000, 2_467_000_000, 2_036_626_234),
  ]);
  assert.equal(f.length, 1);
  assert.equal(f[0].resultat_exploitation, 1_213_000_000);
  assert.equal(f[0].resultat_net, 2_036_626_234);
});

test('les exercices ressortent du plus récent au plus ancien', () => {
  const f = fusionnerExercices([
    L('2023', 1, null, null, null),
    L('2025', 3, null, null, null),
    L('2024', 2, null, null, null),
  ]);
  assert.deepEqual(f.map((x) => x.periode), ['2025', '2024', '2023']);
});

// ── Qualité du bénéfice ─────────────────────────────────────────────────────

test('mesure la part du bénéfice qui ne vient PAS de l’exploitation', () => {
  // NEIC 2025 : exploitation 1,213 Md pour un avant-impôts de 2,467 Md.
  const q = qualiteResultat(L('2025', 5_139_206_354, 1_213_000_000, 2_467_000_000, 2_036_626_234));
  assert.ok(q.part_non_operationnelle > 0.5, 'plus de la moitié est non opérationnelle');
  assert.ok(Math.abs(q.part_non_operationnelle - 0.508) < 0.01);
  assert.ok(Math.abs(q.marge_exploitation - 0.236) < 0.01);
});

test('un exercice sain montre une part non opérationnelle faible', () => {
  // NEIC 2023 : 1,850 Md d'exploitation pour 1,617 Md avant impôts — l'écart
  // n'est que la charge financière, le profit vient bien de l'activité.
  const q = qualiteResultat(L('2023', 8_525_000_000, 1_850_000_000, 1_617_000_000, 1_167_000_000));
  assert.ok(q.part_non_operationnelle < 0, 'les charges financières pèsent, rien d’exceptionnel');
});

test('REFUSE de conclure sans le résultat d’exploitation', () => {
  // Sans les deux termes la question n'a pas de réponse : une approximation
  // serait pire que le silence, puisque le modèle la citerait comme un fait.
  const q = qualiteResultat(L('2025', 5_000_000_000, null, 2_467_000_000, 2_036_626_234));
  assert.equal(q.part_non_operationnelle, null);
});

test('ligne absente -> null, pas une exception', () => {
  assert.equal(qualiteResultat(null), null);
  assert.equal(qualiteResultat(undefined), null);
});

// ── Trajectoire du chiffre d'affaires ───────────────────────────────────────

test('croissance du CA sur un et deux exercices', () => {
  // NEIC : 8,525 Md (2023) -> 6,744 Md (2024) -> 5,139 Md (2025).
  const ex = [
    L('2025', 5_139_206_354, null, null, null),
    L('2024', 6_744_000_000, null, null, null),
    L('2023', 8_525_000_000, null, null, null),
  ];
  assert.ok(Math.abs(croissanceCA(ex, 1) + 0.238) < 0.005, '-23,8 % sur un an');
  assert.ok(Math.abs(croissanceCA(ex, 2) + 0.397) < 0.005, '-39,7 % sur deux ans');
});

test('pas d’exercice de comparaison -> null', () => {
  assert.equal(croissanceCA([L('2025', 5_000, null, null, null)], 1), null);
  assert.equal(croissanceCA([], 1), null);
});

// ── Détachement de dividende ────────────────────────────────────────────────

test('une chute plus forte que le dividende n’est PAS un simple ajustement', () => {
  // Le cas qui a motivé cette fonction : NEIC perd 350 FCFA le jour où il
  // détache 140,40. Écrire « ajustement post-dividende » serait faux.
  const d = expliqueDetachement('2026-09-09', 140.4, 2980, 2630);
  assert.equal(d.baisse_fcfa, 350);
  assert.ok(Math.abs(d.part_expliquee - 0.401) < 0.005, 'le dividende explique 40 % de la baisse');
  assert.ok(d.recul_hors_dividende < -0.07, 'il reste un vrai recul de plus de 7 %');
});

test('une chute égale au dividende est un ajustement propre', () => {
  const d = expliqueDetachement('2026-01-01', 100, 1000, 900);
  assert.equal(d.part_expliquee, 1);
  assert.ok(Math.abs(d.recul_hors_dividende) < 1e-9, 'aucun recul hors dividende');
});

test('une hausse le jour du détachement ne se force pas en pourcentage', () => {
  const d = expliqueDetachement('2026-01-01', 100, 1000, 1010);
  assert.equal(d.part_expliquee, null, 'aucune baisse à expliquer');
});

test('cours ou dividende manquant -> null', () => {
  assert.equal(expliqueDetachement('2026-01-01', null, 1000, 900), null);
  assert.equal(expliqueDetachement('2026-01-01', 100, null, 900), null);
  assert.equal(expliqueDetachement('2026-01-01', 0, 1000, 900), null);
});
