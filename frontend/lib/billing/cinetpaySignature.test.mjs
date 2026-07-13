import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Vérifie la logique de signature du webhook CinetPay.
 *
 * Le webhook est la porte d'entrée de l'argent. On ne le livre pas sur la foi
 * d'une relecture : on prouve qu'une signature forgée est rejetée.
 *
 * (Copie exacte de la fonction du route handler — un test qui importerait la
 * route ferait démarrer Next. Si l'une change, l'autre doit changer.)
 *
 * npx tsx --test lib/billing/cinetpaySignature.test.mjs
 */
function verifySignature(raw, token, secret) {
  if (!secret || !token) return false;
  try {
    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(token, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const SECRET = 'secret-de-test';
const BODY = 'cpm_trans_id=abc-123&cpm_amount=25000&cpm_currency=XOF';
const VALID = createHmac('sha256', SECRET).update(BODY).digest('hex');

test('une signature valide est acceptée', () => {
  assert.equal(verifySignature(BODY, VALID, SECRET), true);
});

test('une signature forgée est rejetée', () => {
  const forge = 'a'.repeat(64);
  assert.equal(verifySignature(BODY, forge, SECRET), false);
});

test('un corps modifié invalide la signature (rejeu altéré)', () => {
  // L'attaque type : intercepter une notification réelle et gonfler le montant.
  const altere = BODY.replace('25000', '5');
  assert.equal(verifySignature(altere, VALID, SECRET), false);
});

test('AUCUN secret configuré => on REFUSE (jamais « laisser passer »)', () => {
  // Un webhook de paiement non authentifiable doit être refusé, pas accepté par
  // défaut. Une config oubliée ne doit pas ouvrir la caisse.
  assert.equal(verifySignature(BODY, VALID, undefined), false);
  assert.equal(verifySignature(BODY, VALID, ''), false);
});

test('token absent => refus', () => {
  assert.equal(verifySignature(BODY, null, SECRET), false);
});

test('un token de longueur différente ne fait pas planter timingSafeEqual', () => {
  // timingSafeEqual LÈVE si les longueurs diffèrent. Sans le garde-fou de
  // longueur, un token court ferait tomber la route en 500 — déni de service.
  assert.doesNotThrow(() => verifySignature(BODY, 'court', SECRET));
  assert.equal(verifySignature(BODY, 'court', SECRET), false);
});

test('un secret différent est rejeté', () => {
  const autre = createHmac('sha256', 'mauvais-secret').update(BODY).digest('hex');
  assert.equal(verifySignature(BODY, autre, SECRET), false);
});
