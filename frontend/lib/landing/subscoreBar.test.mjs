import assert from 'node:assert/strict';
import test from 'node:test';
import { subscoreBar, BORNES } from './subscoreBar.ts';

test('zéro ne dessine RIEN (le défaut historique)', () => {
  const b = subscoreBar(0, BORNES.tendance);
  assert.equal(b.width, 0, 'une tendance nulle ne doit pas remplir la barre');
});

test('pénalité nulle ne dessine RIEN non plus', () => {
  const b = subscoreBar(0, BORNES.liquidite);
  assert.equal(b.width, 0, 'une pénalité nulle produisait auparavant une barre PLEINE');
  assert.equal(b.defavorable, false);
});

test('valeur négative part vers la gauche du zéro', () => {
  const b = subscoreBar(-1, BORNES.rsi);
  assert.equal(b.zero, 50);
  assert.equal(b.left, 0);
  assert.equal(b.width, 50);
  assert.equal(b.defavorable, true);
});

test('valeur positive part vers la droite du zéro', () => {
  const b = subscoreBar(1, BORNES.variation);
  assert.equal(b.left, 50);
  assert.equal(b.width, 50);
  assert.equal(b.defavorable, false);
});

test('une pénalité élevée est défavorable, même si positive', () => {
  const b = subscoreBar(0.25, BORNES.liquidite);
  assert.equal(b.width, 100);
  assert.equal(b.defavorable, true, 'une pénalité forte ne doit pas se peindre comme une bonne nouvelle');
});

test('la valeur est bornée, jamais de barre hors piste', () => {
  const b = subscoreBar(5, BORNES.rsi);
  assert.ok(b.left + b.width <= 100.0001, `${b.left}+${b.width}`);
});

test('null ou non fini -> pas de barre', () => {
  assert.equal(subscoreBar(null, BORNES.rsi), null);
  assert.equal(subscoreBar(NaN, BORNES.rsi), null);
});

test('SPHC, le cas qui a motivé la correction', () => {
  // Avant : Tendance 0.10 et Liquidité 0.00 s'affichaient toutes deux PLEINES,
  // et RSI -1.00 s'affichait VIDE. Les trois se lisaient à l'envers.
  assert.equal(subscoreBar(0.1, BORNES.tendance).width, 50);
  assert.equal(subscoreBar(0, BORNES.liquidite).width, 0);
  const rsi = subscoreBar(-1, BORNES.rsi);
  assert.equal(rsi.width, 50);
  assert.equal(rsi.defavorable, true);
});
