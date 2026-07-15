import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDividendYield } from './dividendYield.ts';

/** npx tsx --test lib/citable/dividendYield.test.mjs */

const COURS = [
  { code: 'SNTS', cours_jour: 30900, designation: 'SONATEL' },
  { code: 'BOAC', cours_jour: 9620, designation: 'BANK OF AFRICA CI' },
  { code: 'FTSC', cours_jour: 1975, designation: 'FILTISAC' },
  { code: 'ZERO', cours_jour: 0, designation: 'Titre suspendu' },
];

test('rendement NET, trié, exercice de référence commun', () => {
  const r = buildDividendYield(
    [
      { code: 'SNTS', exercice: 2025, montant: 1740 },
      { code: 'BOAC', exercice: 2025, montant: 594.5 },
    ],
    COURS,
  );
  assert.equal(r.exerciceRef, 2025);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].code, 'BOAC'); // 594.5/9620 = 6.18 % > 1740/30900 = 5.63 %
  assert.equal(r.rows[0].rendementPct, 6.18);
  assert.equal(r.rows[1].rendementPct, 5.63);
  // Toutes les lignes portent le MÊME exercice — comparabilité.
  assert.ok(r.rows.every((x) => x.exercice === 2025));
});

test('LE BUG FILTISAC : dividende 0 en 2025 → titre EXCLU, pas de repli sur 2024', () => {
  // FILTISAC n'a rien distribué en 2025 (0), mais a versé 1726 en 2024.
  // L'ancien code affichait 1726/1975 = 87 %. Le nouveau l'exclut.
  const r = buildDividendYield(
    [
      { code: 'FTSC', exercice: 2025, montant: 0 },
      { code: 'FTSC', exercice: 2024, montant: 1726.55 },
      { code: 'SNTS', exercice: 2025, montant: 1740 },
    ],
    COURS,
  );
  assert.equal(r.exerciceRef, 2025);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].code, 'SNTS');
  assert.ok(!r.rows.some((x) => x.code === 'FTSC'));
});

test('un titre dont le dernier dividende est ANCIEN (2022) est exclu du classement 2025', () => {
  // BERNABE, UNIWAX, etc. : dernier dividende sur exercice antérieur → hors classement.
  const r = buildDividendYield(
    [
      { code: 'SNTS', exercice: 2025, montant: 1740 },
      { code: 'VIEUX', exercice: 2022, montant: 500 },
    ],
    [...COURS, { code: 'VIEUX', cours_jour: 5000, designation: 'Titre à dividende ancien' }],
  );
  assert.equal(r.exerciceRef, 2025);
  assert.deepEqual(r.rows.map((x) => x.code), ['SNTS']);
});

test('exercice de référence = le plus récent RÉELLEMENT distribué (montant > 0)', () => {
  // Une ligne 2025 à 0 pour tous ne fait PAS de 2025 la référence si personne n'a distribué.
  const r = buildDividendYield(
    [
      { code: 'SNTS', exercice: 2025, montant: 0 }, // annoncé nul
      { code: 'SNTS', exercice: 2024, montant: 1655 }, // vrai dernier versé
      { code: 'BOAC', exercice: 2024, montant: 459 },
    ],
    COURS,
  );
  assert.equal(r.exerciceRef, 2024);
  assert.equal(r.rows.length, 2);
});

test('titre sans cours OU cours à zéro : écarté, jamais de rendement infini', () => {
  const r = buildDividendYield(
    [
      { code: 'ZERO', exercice: 2025, montant: 500 }, // cours = 0
      { code: 'FANTOME', exercice: 2025, montant: 500 }, // aucun cours
      { code: 'SNTS', exercice: 2025, montant: 1740 },
    ],
    COURS,
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].code, 'SNTS');
});

test('aucun dividende : classement vide, jamais un chiffre inventé', () => {
  const r = buildDividendYield([], COURS);
  assert.deepEqual(r.rows, []);
});

test('dividende à exercice NULL ignoré (annoncé sans exercice identifié)', () => {
  const r = buildDividendYield(
    [
      { code: 'SNTS', exercice: null, montant: 9999 },
      { code: 'SNTS', exercice: 2025, montant: 1740 },
    ],
    COURS,
  );
  assert.equal(r.rows[0].dividende, 1740);
});
