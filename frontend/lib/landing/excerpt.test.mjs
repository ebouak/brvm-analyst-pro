import { test } from 'node:test';
import assert from 'node:assert/strict';
import { excerpt } from './excerpt.ts';

test('ne tronque pas un texte déjà plus court que maxLen', () => {
  assert.equal(excerpt('Texte court.'), 'Texte court.');
});

test('préserve un signe négatif dans un pourcentage (ne pas confondre avec une puce de liste)', () => {
  const md = 'Le chiffre d\'affaires recule de -3,2 % sur la période, un repli marqué.';
  assert.match(excerpt(md), /-3,2 %/);
});

test('retire les puces de liste en début de ligne sans toucher les tirets ailleurs', () => {
  const md = '- Rentabilité solide\n- Dette maîtrisée\nCroissance de -1,5 % du CA.';
  const out = excerpt(md);
  assert.doesNotMatch(out, /^-/);
  assert.match(out, /-1,5 %/);
});

test('retire les titres markdown', () => {
  assert.equal(excerpt('## Synthèse\nAnalyse détaillée.'), 'Synthèse Analyse détaillée.');
});

test('retire emphase et code inline', () => {
  assert.equal(excerpt('Le **ROE** est de `12%`.'), 'Le ROE est de 12%.');
});

test('tronque à la dernière frontière de mot avant maxLen', () => {
  const long = 'mot '.repeat(100).trim();
  const out = excerpt(long, 20);
  assert.ok(out.endsWith('…'));
  assert.ok(out.length <= 21);
  assert.doesNotMatch(out.slice(0, -1), /\s$/);
});

test('gère un bloc sans espace dans les maxLen premiers caractères sans planter', () => {
  const noSpace = 'x'.repeat(300);
  const out = excerpt(noSpace, 280);
  assert.equal(out, `${'x'.repeat(280)}…`);
});
