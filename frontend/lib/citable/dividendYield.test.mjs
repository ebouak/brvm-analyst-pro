import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDividendYield } from './dividendYield.ts';

/** npx tsx --test lib/citable/dividendYield.test.mjs */

const COURS = [
  { code: 'SNTS', cours_jour: 30900, designation: 'SONATEL' },
  { code: 'BOAC', cours_jour: 9620, designation: 'BANK OF AFRICA CI' },
  { code: 'ZERO', cours_jour: 0, designation: 'Titre suspendu' },
  { code: 'NOCOURS', cours_jour: 1000, designation: 'Sans dividende' },
];

test('rendement = dividende / cours, trié du meilleur au moins bon', () => {
  const r = buildDividendYield(
    [
      { code: 'SNTS', exercice: 2024, montant: 1740 },
      { code: 'BOAC', exercice: 2024, montant: 594 },
    ],
    COURS,
  );
  assert.equal(r.length, 2);
  assert.equal(r[0].code, 'BOAC'); // 594/9620 = 6.17 % > 1740/30900 = 5.63 %
  assert.equal(r[0].rendementPct, 6.17);
  assert.equal(r[1].rendementPct, 5.63);
});

test('on retient le dividende de l’exercice le plus RÉCENT', () => {
  const r = buildDividendYield(
    [
      { code: 'SNTS', exercice: 2022, montant: 1500 },
      { code: 'SNTS', exercice: 2024, montant: 1740 },
      { code: 'SNTS', exercice: 2023, montant: 1575 },
    ],
    COURS,
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].exercice, 2024);
  assert.equal(r[0].dividende, 1740);
});

test('dividende à exercice NULL ignoré — pas de mélange annoncé/versé', () => {
  const r = buildDividendYield(
    [
      { code: 'SNTS', exercice: null, montant: 9999 }, // annoncé, non confirmé
      { code: 'SNTS', exercice: 2024, montant: 1740 },
    ],
    COURS,
  );
  assert.equal(r[0].dividende, 1740); // le confirmé, jamais le 9999 non daté
});

test('titre sans cours OU cours à zéro : écarté, jamais de rendement infini', () => {
  const r = buildDividendYield(
    [
      { code: 'ZERO', exercice: 2024, montant: 500 }, // cours = 0
      { code: 'FANTOME', exercice: 2024, montant: 500 }, // aucun cours
      { code: 'SNTS', exercice: 2024, montant: 1740 },
    ],
    COURS,
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].code, 'SNTS');
});

test('titre sans dividende confirmé : absent du classement', () => {
  const r = buildDividendYield([], COURS);
  assert.deepEqual(r, []);
});

test('montant nul ou négatif : ignoré', () => {
  const r = buildDividendYield(
    [
      { code: 'SNTS', exercice: 2024, montant: 0 },
      { code: 'BOAC', exercice: 2024, montant: -5 },
    ],
    COURS,
  );
  assert.deepEqual(r, []);
});
