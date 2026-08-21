// frontend/lib/whatsappAgent/pairing.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePairingCode, isPairingCode } from './pairing.ts';

test('génère un code au format attendu', () => {
  const code = generatePairingCode();
  assert.match(code, /^WB-[A-Z0-9]{6}$/);
});

test('deux codes successifs diffèrent', () => {
  assert.notEqual(generatePairingCode(), generatePairingCode());
});

test('reconnaît un code d\'appairage dans un message', () => {
  assert.equal(isPairingCode('WB-7K3P9Q'), true);
  assert.equal(isPairingCode('  wb-7k3p9q  '), true);
});

test('ne confond pas un message normal avec un code', () => {
  assert.equal(isPairingCode('Quel est le cours de SONATEL ?'), false);
  assert.equal(isPairingCode('WB-123'), false);
});

test('exclut les caractères ambigus (O/0, I/1)', () => {
  for (let i = 0; i < 50; i++) {
    assert.doesNotMatch(generatePairingCode().slice(3), /[O0I1]/);
  }
});
