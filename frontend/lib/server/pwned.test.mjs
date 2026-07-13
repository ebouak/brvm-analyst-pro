import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPasswordPwned } from './pwned.ts';

/**
 * Test d'intégration réel contre l'API HaveIBeenPwned (publique, sans clé).
 *
 * Volontairement NON mocké : ce qu'on veut vérifier, c'est justement que le
 * protocole k-anonymity est correctement implémenté face au vrai service — un
 * mock validerait ma compréhension du protocole, pas le protocole lui-même.
 *
 * Lancer :  npx tsx --test lib/server/pwned.test.mjs
 */

test('un mot de passe massivement fuité est rejeté', async () => {
  const r = await isPasswordPwned('password123');
  if (r.unavailable) {
    console.warn('HIBP injoignable — test ignoré.');
    return;
  }
  assert.equal(r.pwned, true, '"password123" doit être reconnu comme compromis');
  assert.ok(r.count > 1000, `attendu un compte élevé, reçu ${r.count}`);
});

test('un mot de passe aléatoire long n’est pas rejeté', async () => {
  // Aléatoire à chaque exécution : il ne peut pas figurer dans une fuite.
  const random = `wb-${Math.random().toString(36).slice(2)}-${Date.now()}-Xq9!`;
  const r = await isPasswordPwned(random);
  if (r.unavailable) return;
  assert.equal(r.pwned, false, 'un mot de passe inédit ne doit pas être signalé');
  assert.equal(r.count, 0);
});

test('le padding de HIBP ne produit pas de faux positif', async () => {
  // Avec `Add-Padding`, HIBP insère de faux suffixes dont le compte est 0.
  // Si on ne filtrait pas sur count > 0, des mots de passe sains seraient
  // rejetés au hasard — bug silencieux et exaspérant pour l'utilisateur.
  let faux = 0;
  for (let i = 0; i < 5; i++) {
    const r = await isPasswordPwned(`inedit-${Math.random().toString(36).slice(2)}-${i}`);
    if (!r.unavailable && r.pwned) faux++;
  }
  assert.equal(faux, 0, 'aucun mot de passe inédit ne doit être signalé comme compromis');
});
