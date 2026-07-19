import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCopilotQuery, findSociete, normalize } from './parse.ts';

const INSTR = [
  { code: 'SNTS', designation: 'SONATEL SENEGAL' },
  { code: 'PALC', designation: 'PALM COTE D IVOIRE' },
  { code: 'SGBC', designation: 'SOCIETE GENERALE COTE D IVOIRE' },
  { code: 'TTLC', designation: 'TOTALENERGIES MARKETING COTE D IVOIRE' },
];

test('normalize retire les accents et met en minuscules', () => {
  assert.equal(normalize('Société Générale'), 'societe generale');
});

test('fondamentaux de Sonatel → /financials/SNTS', () => {
  const r = parseCopilotQuery('fondamentaux de Sonatel', INSTR);
  assert.deepEqual(r, { type: 'navigate', href: '/financials/SNTS', label: 'Fondamentaux — SONATEL SENEGAL' });
});

test('code seul SNTS → fiche action', () => {
  const r = parseCopilotQuery('snts', INSTR);
  assert.equal(r.type, 'navigate');
  assert.equal(r.href, '/actions/SNTS');
});

test('diagnostic palc → page diagnostic premium', () => {
  const r = parseCopilotQuery('diagnostic PALC', INSTR);
  assert.equal(r.href, '/premium/diagnostic/PALC');
});

test('actions avec PER < 10 → filtre_per lt 10', () => {
  const r = parseCopilotQuery('actions avec PER < 10', INSTR);
  assert.deepEqual(r, { type: 'filtre_per', op: 'lt', seuil: 10 });
});

test('per inférieur à 8,5 (virgule FR) → seuil 8.5', () => {
  const r = parseCopilotQuery('per inférieur à 8,5', INSTR);
  assert.deepEqual(r, { type: 'filtre_per', op: 'lt', seuil: 8.5 });
});

test('rendement supérieur à 7 → filtre_rendement gt 7', () => {
  const r = parseCopilotQuery('rendement supérieur à 7 %', INSTR);
  assert.deepEqual(r, { type: 'filtre_rendement', op: 'gt', seuil: 7 });
});

test('requête inconnue → null (fallback LLM)', () => {
  assert.equal(parseCopilotQuery('quelle est la meilleure banque ?', INSTR), null);
});

test('findSociete ne confond pas un mot court', () => {
  // « per » ne doit matcher aucun code/désignation.
  assert.equal(findSociete(normalize('per bas'), INSTR), null);
});

test('nom partiel « totalenergies » → TTLC', () => {
  const r = parseCopilotQuery('cours de TotalEnergies', INSTR);
  assert.equal(r.href, '/actions/TTLC');
});
