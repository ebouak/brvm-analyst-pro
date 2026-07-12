// Exécuter : cd frontend && npx tsx lib/api/keys.test.mjs
import assert from 'node:assert';
import { generateKey, hashKey, isWellFormedKey } from './keys.ts';
import { maskKey } from './mask.ts';

// Génération : format attendu, hash cohérent, préfixe non secret.
const k = generateKey();
assert.ok(isWellFormedKey(k.key), `clé mal formée : ${k.key}`);
assert.equal(k.hash, hashKey(k.key));
assert.equal(k.hash.length, 64); // sha256 hex
assert.ok(k.key.startsWith(k.prefix), 'le préfixe doit préfixer la clé');
assert.ok(k.prefix.length < k.key.length, 'le préfixe ne doit pas être la clé entière');

// Le hash ne permet pas de remonter à la clé (il ne la contient pas).
assert.ok(!k.hash.includes(k.key.replace('wb_live_', '')), 'le hash ne doit pas contenir le secret');

// Deux générations donnent des clés différentes (entropie réelle).
assert.notEqual(generateKey().key, generateKey().key);

// hashKey est déterministe — c'est ce qui permet la vérification en base.
assert.equal(hashKey('wb_live_abc'), hashKey('wb_live_abc'));
assert.notEqual(hashKey('wb_live_abc'), hashKey('wb_live_abd'));

// Validation de forme : rejette tout ce qui n'est pas une clé plausible.
assert.equal(isWellFormedKey(undefined), false);
assert.equal(isWellFormedKey(''), false);
assert.equal(isWellFormedKey('wb_live_XYZ'), false); // non hexadécimal
assert.equal(isWellFormedKey('wb_live_' + 'a'.repeat(63)), false); // trop court
assert.equal(isWellFormedKey('sk_live_' + 'a'.repeat(64)), false); // mauvais préfixe

// Masquage : ne révèle jamais le secret complet.
assert.ok(maskKey('wb_live_a1b2c3d4').includes('•'));
assert.equal(maskKey(null), '—');

console.log('✓ keys.test.mjs : tous les tests passent');
