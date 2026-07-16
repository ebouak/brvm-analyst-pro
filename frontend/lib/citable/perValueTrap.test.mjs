import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPerValueTrap, perTrapSummary } from './perValueTrap.ts';

/** npx tsx --test lib/citable/perValueTrap.test.mjs */

const income = [
  // PALC : décote piège (PER bas, 4 ans de baisse)
  { code: 'PALC', periode: '2022', resultat_net: 41_693e6, benefice_par_action: 2697 },
  { code: 'PALC', periode: '2023', resultat_net: 19_352e6, benefice_par_action: 1252 },
  { code: 'PALC', periode: '2024', resultat_net: 15_862e6, benefice_par_action: 1026 },
  { code: 'PALC', periode: '2025', resultat_net: 15_509e6, benefice_par_action: 1003 },
  // SNTS : décote réelle (PER bas, croissance)
  { code: 'SNTS', periode: '2023', resultat_net: 331_748e6, benefice_par_action: 3317 },
  { code: 'SNTS', periode: '2024', resultat_net: 393_662e6, benefice_par_action: 3937 },
  { code: 'SNTS', periode: '2025', resultat_net: 413_588e6, benefice_par_action: 4136 },
  // SCRC : perte
  { code: 'SCRC', periode: '2024', resultat_net: 2_000e6, benefice_par_action: 50 },
  { code: 'SCRC', periode: '2025', resultat_net: -6_100e6, benefice_par_action: null },
];
const cours = [
  { code: 'PALC', cours_jour: 8600, designation: 'PALM COTE D\'IVOIRE' },
  { code: 'SNTS', cours_jour: 31800, designation: 'SONATEL' },
  { code: 'SCRC', cours_jour: 800, designation: 'SUCRIVOIRE' },
  { code: 'ZZZZ', cours_jour: 1000, designation: 'Sans états financiers' }, // pas d'income
];

test('classe chaque titre selon PER × trajectoire du bénéfice', () => {
  const rows = buildPerValueTrap(income, cours);
  const by = Object.fromEntries(rows.map((r) => [r.code, r]));
  assert.equal(by.PALC.verdict, 'trap-decote-piege');
  assert.equal(by.SNTS.verdict, 'decote-reelle');
  assert.equal(by.SCRC.verdict, 'perte');
});

test('PER = cours / BPA du dernier exercice', () => {
  const rows = buildPerValueTrap(income, cours);
  const palc = rows.find((r) => r.code === 'PALC');
  assert.ok(Math.abs(palc.per - 8600 / 1003) < 0.01);
});

test('un titre sans états financiers est ignoré (pas de ligne fabriquée)', () => {
  const rows = buildPerValueTrap(income, cours);
  assert.equal(rows.find((r) => r.code === 'ZZZZ'), undefined);
});

test('les dangers (pièges + pertes) remontent en tête du classement', () => {
  const rows = buildPerValueTrap(income, cours);
  // Les deux premiers sont des dangers, la décote réelle vient après.
  assert.equal(rows[0].severity, 'danger');
  assert.equal(rows[rows.length - 1].code, 'SNTS'); // good en dernier
});

test('summary compte les verdicts', () => {
  const s = perTrapSummary(buildPerValueTrap(income, cours));
  assert.equal(s['trap-decote-piege'], 1);
  assert.equal(s['decote-reelle'], 1);
  assert.equal(s['perte'], 1);
});
