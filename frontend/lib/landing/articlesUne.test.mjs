import assert from 'node:assert/strict';
import test from 'node:test';
import { choisirUne } from './articlesUne.ts';

/** Lancer : npx tsx --test lib/landing/articlesUne.test.mjs */
const art = (slug, type, publie_le) => ({ slug, type, code: null, titre: slug, chapo: '', date_fait: publie_le.slice(0, 10), publie_le });
const maintenant = new Date('2026-10-29T12:00:00Z');

test('un décryptage récent passe à la une devant un article plus récent', () => {
  const r = choisirUne([art('paiement', 'paiement_rappel', '2026-10-29T09:00:00Z'), art('snts', 'decryptage', '2026-10-28T10:00:00Z')], maintenant);
  assert.equal(r.une.slug, 'snts');
  assert.deepEqual(r.autres.map((a) => a.slug), ['paiement']);
});

test('un décryptage ancien ne prend plus la une', () => {
  const r = choisirUne([art('paiement', 'paiement_rappel', '2026-10-29T09:00:00Z'), art('vieux', 'decryptage', '2026-08-01T10:00:00Z')], maintenant);
  assert.equal(r.une.slug, 'paiement');
  assert.deepEqual(r.autres.map((a) => a.slug), ['vieux']);
});

test('plafonne les autres articles à trois, et rien sans article', () => {
  const liste = ['a', 'b', 'c', 'd', 'e'].map((s, i) => art(s, 'dividende_annonce', `2026-10-2${8 - i}T09:00:00Z`));
  const r = choisirUne(liste, maintenant);
  assert.equal(r.une.slug, 'a');
  assert.equal(r.autres.length, 3);
  assert.deepEqual(choisirUne([], maintenant), { une: null, autres: [] });
});
