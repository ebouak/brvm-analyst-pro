import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyMetaSignature } from './verifySignature.ts';

const SECRET = 'test-app-secret';

function sign(body) {
  const hmac = crypto.createHmac('sha256', SECRET).update(body, 'utf8').digest('hex');
  return `sha256=${hmac}`;
}

test('accepte une signature valide', () => {
  const body = '{"hello":"world"}';
  const header = sign(body);
  assert.equal(verifyMetaSignature(body, header, SECRET), true);
});

test('rejette une signature invalide', () => {
  const body = '{"hello":"world"}';
  assert.equal(verifyMetaSignature(body, 'sha256=deadbeef', SECRET), false);
});

test('rejette un en-tête absent', () => {
  const body = '{"hello":"world"}';
  assert.equal(verifyMetaSignature(body, null, SECRET), false);
});

test('rejette un corps modifié après signature', () => {
  const original = '{"hello":"world"}';
  const header = sign(original);
  const tampered = '{"hello":"WORLD"}';
  assert.equal(verifyMetaSignature(tampered, header, SECRET), false);
});

test('rejette un hex invalide de même longueur sans lever d\'exception', () => {
  const body = '{"hello":"world"}';
  const header = `sha256=${'a'.repeat(63)}g`;
  assert.doesNotThrow(() => {
    assert.equal(verifyMetaSignature(body, header, SECRET), false);
  });
});
