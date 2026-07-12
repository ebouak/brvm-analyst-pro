// Tests normalisation E.164. Exécuter : cd frontend && npx tsx lib/notifications/phone.test.mjs
import assert from 'node:assert';
import { normalizeE164 } from './phone.ts';

// International déjà propre.
assert.equal(normalizeE164('+2250701020304'), '+2250701020304');
// Espaces, points, tirets, parenthèses tolérés.
assert.equal(normalizeE164('+225 07 01 02 03 04'), '+2250701020304');
assert.equal(normalizeE164('00225-07.01(02)03 04'), '+2250701020304');
// National CI : le 0 initial se conserve.
assert.equal(normalizeE164('07 01 02 03 04', '+225'), '+2250701020304');
// National Sénégal (9 chiffres sans 0).
assert.equal(normalizeE164('77 123 45 67', '+221'), '+221771234567');
// Invalides → null.
assert.equal(normalizeE164(''), null);
assert.equal(normalizeE164('abc'), null);
assert.equal(normalizeE164('+225'), null);           // trop court
assert.equal(normalizeE164('12345', '+225'), null);  // 8 chiffres au total < 10 → rejeté

console.log('✓ phone.test.mjs : tous les tests passent');
