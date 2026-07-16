import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessValueTrap } from './valueTrap.ts';

/** npx tsx --test lib/fundamentals/valueTrap.test.mjs */

test('décote piège : PER bas + 4 ans de baisse (cas PALC réel)', () => {
  const r = assessValueTrap({
    per: 8.6,
    netIncomeSeries: [41_693e6, 19_352e6, 15_862e6, 15_509e6], // 2022→2025
  });
  assert.equal(r.verdict, 'trap-decote-piege');
  assert.equal(r.isTrap, true);
  assert.equal(r.severity, 'danger');
  assert.ok(r.metrics.baissesConsec >= 2);
});

test('bénéfice effondré : PER gonflé mécaniquement (cas BOAN réel)', () => {
  const r = assessValueTrap({
    per: 274,
    netIncomeSeries: [10_076e6, 5_002e6, 409e6], // effondrement 2023→2025
  });
  assert.equal(r.verdict, 'trap-benefice-effondre');
  assert.equal(r.isTrap, true);
  assert.equal(r.severity, 'danger');
});

test('perte : résultat net négatif → PER n/a (cas Sucrivoire)', () => {
  const r = assessValueTrap({ per: null, netIncomeSeries: [2_000e6, -6_100e6] });
  assert.equal(r.verdict, 'perte');
  assert.equal(r.isTrap, false);
  assert.equal(r.severity, 'danger');
});

test('décote réelle : PER bas + bénéfices en hausse (cas Sonatel)', () => {
  const r = assessValueTrap({
    per: 7.7,
    netIncomeSeries: [278_912e6, 331_748e6, 393_662e6, 413_588e6],
  });
  assert.equal(r.verdict, 'decote-reelle');
  assert.equal(r.isTrap, false);
  assert.equal(r.severity, 'good');
  assert.ok(r.metrics.cagr > 0);
});

test('sain : PER moyen + bénéfices stables', () => {
  const r = assessValueTrap({ per: 12, netIncomeSeries: [10_000e6, 10_500e6, 11_000e6] });
  assert.equal(r.verdict, 'sain');
  assert.equal(r.isTrap, false);
});

test('cher : PER élevé sans déclin → croissance à confirmer', () => {
  const r = assessValueTrap({ per: 34, netIncomeSeries: [3_000e6, 3_200e6, 3_400e6] });
  assert.equal(r.verdict, 'cher-croissance');
  assert.equal(r.severity, 'warn');
});

test('un PER bas ne suffit pas : léger repli récent n’est pas un piège', () => {
  // -5 % sur un an, pas de série de baisses, cagr positif → sain, pas trap
  const r = assessValueTrap({ per: 11, netIncomeSeries: [9_000e6, 12_000e6, 11_400e6] });
  assert.notEqual(r.verdict, 'trap-decote-piege');
  assert.equal(r.isTrap, false);
});

test('données insuffisantes : une seule année, PER ok → indéterminé si pas de déclin détectable', () => {
  const r = assessValueTrap({ per: 12, netIncomeSeries: [10_000e6] });
  // Pas de tendance calculable → ni trap ni décote, verdict neutre
  assert.equal(r.isTrap, false);
  assert.equal(r.metrics.cagr, null);
});

test('PER manquant sans perte → indéterminé, jamais un faux positif', () => {
  const r = assessValueTrap({ per: null, netIncomeSeries: [10_000e6, 11_000e6] });
  assert.equal(r.verdict, 'indetermine');
  assert.equal(r.isTrap, false);
});

test('les null de la série sont ignorés, pas comptés comme zéro', () => {
  const r = assessValueTrap({ per: 9, netIncomeSeries: [null, 10_000e6, null, 11_000e6] });
  assert.equal(r.metrics.baissesConsec, 0);
  assert.equal(r.verdict, 'decote-reelle');
});
