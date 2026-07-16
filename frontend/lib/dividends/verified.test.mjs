import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectVerified, rendementDividende } from './verified.ts';

/** npx tsx --test lib/dividends/verified.test.mjs */

test('ne retient QUE les dividendes à ex_date (détachement daté)', () => {
  // Le cœur du correctif : la valeur société (sans ex_date) est écartée au profit
  // de la valeur vérifiée, même si la société est « plus récente » en exercice.
  const m = selectVerified([
    { code: 'SLBC', montant: 1871.76, exercice: 2025, ex_date: null }, // fiche société, biaisée
    { code: 'SLBC', montant: 2127.0, exercice: 2025, ex_date: '2026-07-29' }, // détachement, vrai
  ]);
  assert.equal(m.get('SLBC').montant, 2127.0);
});

test('un titre SANS aucun détachement daté est absent (pas de valeur société de repli)', () => {
  const m = selectVerified([
    { code: 'XXXX', montant: 500, exercice: 2025, ex_date: null },
  ]);
  assert.equal(m.has('XXXX'), false);
});

test('exercice le plus récent retenu', () => {
  const m = selectVerified([
    { code: 'SNTS', montant: 1655, exercice: 2024, ex_date: '2025-06-30' },
    { code: 'SNTS', montant: 1740, exercice: 2025, ex_date: '2026-07-01' },
  ]);
  assert.equal(m.get('SNTS').montant, 1740);
  assert.equal(m.get('SNTS').exercice, 2025);
});

test('à exercice égal, la date de détachement la plus récente', () => {
  const m = selectVerified([
    { code: 'ABJC', montant: 124, exercice: 2025, ex_date: '2026-09-29' },
    { code: 'ABJC', montant: 999, exercice: 2025, ex_date: '2026-03-01' }, // plus ancienne
  ]);
  assert.equal(m.get('ABJC').montant, 124);
});

test('montant nul ou négatif ignoré', () => {
  const m = selectVerified([
    { code: 'A', montant: 0, exercice: 2025, ex_date: '2026-07-01' },
    { code: 'B', montant: -5, exercice: 2025, ex_date: '2026-07-01' },
  ]);
  assert.equal(m.size, 0);
});

test('rendementDividende : arrondi 2 décimales, null si cours invalide', () => {
  assert.equal(rendementDividende(594.5, 9620), 6.18);
  assert.equal(rendementDividende(500, 0), null);
  assert.equal(rendementDividende(500, null), null);
});
