import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libelleAbsence, dateArrete, NON_TROUVE } from './prudentiel.ts';

/** npx tsx --test lib/bank/prudentiel.test.mjs */

const o = (p) => ({ date_arrete: '2024-12-31', statut: 'publie', motif: null, comparateur: '=', valeur: null, ...p });

test('sources contradictoires (BOAS 2024)', () => {
  const obs = [o({ statut: 'publie_non_exploitable', motif: 'source_conflict' }), o({ statut: 'publie_non_exploitable', motif: 'source_conflict' })];
  assert.equal(libelleAbsence(obs, '2024'), 'publié mais non exploitable — sources contradictoires');
});

test('borne publiée (SIBC 2025 : > 14 %)', () => {
  const obs = [o({ date_arrete: '2025-12-31', comparateur: '>', valeur: '14' })];
  assert.equal(libelleAbsence(obs, '2025'), 'publié sous forme de borne (> 14 %), sans valeur exacte');
});

test('estimation', () => {
  assert.equal(libelleAbsence([o({ valeur: 12.6, motif: 'estime' })], '2024'), 'publié comme estimation — non retenu');
});

test('non applicable', () => {
  assert.equal(libelleAbsence([o({ statut: 'non_applicable' })], '2024'), 'non applicable');
});

test('aucune observation, ou un autre exercice seulement → non trouvé', () => {
  assert.equal(libelleAbsence([], '2024'), NON_TROUVE);
  const conflit2024 = [o({ statut: 'publie_non_exploitable', motif: 'source_conflict' })];
  assert.equal(libelleAbsence(conflit2024, '2025'), NON_TROUVE);
});

test('période au format date (BICB) et période non annuelle', () => {
  assert.equal(dateArrete('2025-12-31'), '2025-12-31');
  assert.equal(dateArrete('2025'), '2025-12-31');
  assert.equal(dateArrete('2024-01-01'), null);
  assert.equal(libelleAbsence([o({ statut: 'non_applicable' })], '2024-S1'), NON_TROUVE);
});
