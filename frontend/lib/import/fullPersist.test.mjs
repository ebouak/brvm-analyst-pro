import assert from 'node:assert/strict';
import test from 'node:test';
import { detteImportee } from './fullPersist.ts';

test('dette importée hors banques : long terme + court terme (SNTS 2025 : 232 660 + 170 026 M = comptes certifiés)', () => {
  assert.equal(detteImportee('SNTS', { dette_long_terme: 232_660e6, dette_court_terme: 170_026e6 }), 402_686e6);
  assert.equal(detteImportee('TTLC', { dette_long_terme: null, dette_court_terme: 30.78e9 }), 30.78e9, 'rubrique absente = zéro');
  assert.equal(detteImportee('SNTS', { dette_long_terme: null, dette_court_terme: null }), null);
});

test('dette importée banque : long terme seul, jamais les dépôts du court terme', () => {
  assert.equal(detteImportee('ORGT', { dette_long_terme: 26.4e9, dette_court_terme: 3088.7e9 }), 26.4e9);
});
