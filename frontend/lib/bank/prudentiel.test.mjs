import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libelleAbsence, dateArrete, NON_TROUVE, serieRetenue, ligneQualiteActif } from './prudentiel.ts';

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


const t = (annee, valeur, p = {}) => ({ indicateur: 'taux_creances_souffrance', date_arrete: `${annee}-12-31`, statut: 'publie', motif: null, comparateur: '=', valeur, ...p });

test('série : années triées, valeurs identiques gardées', () => {
  const s = serieRetenue([t(2025, 8), t(2023, 6.8), t(2024, 7.5), t(2024, 7.5)], 'taux_creances_souffrance');
  assert.deepEqual(s, [{ annee: '2023', valeur: 6.8 }, { annee: '2024', valeur: 7.5 }, { annee: '2025', valeur: 8 }]);
});

test('série : deux valeurs différentes ou un conflit marqué → année absente, jamais tranchée', () => {
  assert.deepEqual(serieRetenue([t(2024, 7.5), t(2024, 7.9)], 'taux_creances_souffrance'), []);
  assert.deepEqual(serieRetenue([t(2024, 7.5), t(2024, null, { statut: 'publie_non_exploitable', motif: 'source_conflict' })], 'taux_creances_souffrance'), []);
});

test('série : borne, estimation et date semestrielle écartées', () => {
  const s = serieRetenue([t(2024, 14, { comparateur: '>' }), t(2023, 6, { motif: 'estime' }), { ...t(2025, 9), date_arrete: '2025-06-30' }], 'taux_creances_souffrance');
  assert.deepEqual(s, []);
});

test('ligne du prompt : taux et couverture, format français', () => {
  const l = ligneQualiteActif([t(2023, 6.8), t(2025, 8), { ...t(2025, 82), indicateur: 'couverture_creances_souffrance' }]);
  assert.equal(l, 'Créances en souffrance / crédits (taux publié par la banque) : 2023 6,8 % · 2025 8 % | Couverture des créances en souffrance (publiée) : 2025 82 %');
  assert.equal(ligneQualiteActif([]), null);
});
