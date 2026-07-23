import assert from 'node:assert';
import { assessQuality } from './fundamentals.ts';

// PER negatif = societe en perte. Le calcul est juste, le ratio n'a pas de sens.
// Cas reels du screener : STAC -417,57 / UNXC -61,19 / SICC -24,65 / SCRC -11,19.
for (const v of [-417.57, -61.19, -24.65, -11.19, -0.01]) {
  assert.equal(assessQuality('per', v), 'ns', `PER ${v} doit etre non significatif, pas suspect`);
}
// Au-dela de 1000, c'est bien l'extraction qui est en cause.
assert.equal(assessQuality('per', 1500), 'suspect');
assert.equal(assessQuality('per', 12.5), 'ok');
assert.equal(assessQuality('per', 0), 'ok');
assert.equal(assessQuality('per', null), 'missing');

// P/B : capitaux propres negatifs -> non significatif ; 113,02 (STAC) reste
// suspect car positif mais aberrant.
assert.equal(assessQuality('pb', -3), 'ns');
assert.equal(assessQuality('pb', 113.02), 'suspect');
assert.equal(assessQuality('pb', 4.15), 'ok');

// Les autres metriques ne sont pas affectees par le changement.
assert.equal(assessQuality('roe', -0.271), 'ok', 'un ROE negatif reste une donnee lisible');
assert.equal(assessQuality('margeNette', -0.025), 'ok', 'une marge negative reste lisible');
assert.equal(assessQuality('rendementDiv', -0.1), 'suspect', 'un rendement negatif reste anormal');
assert.equal(assessQuality('net_income', -10_324_162_375), 'ok', 'une perte reelle n\'est pas suspecte');

console.log('✓ assessQuality — PER/PB non significatifs OK');
