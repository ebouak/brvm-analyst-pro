/**
 * Tests fournis par l'exploitant (node:test), convertis en vitest : mêmes
 * assertions, `assert.ok` → `toBe(true)`, `assert.equal` → `toBe` (égalité stricte).
 */
import { test, expect } from 'vitest';
import { nervosite, serieNervosite, rendementsLog, rendementMarche, rangHistorique, rangsGlissants, regime, FENETRE_LENTE, FENETRE_RANG, MIN_RANG } from './nervosite';

/** Générateur pseudo-aléatoire reproductible, loi normale. */
function gauss(graine: number) {
  let s = graine >>> 0;
  const u = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) + 1) / 4294967297;
  return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
}
const serie = (n: number, sigmaJour: number, graine = 7) => { const g = gauss(graine); return Array.from({ length: n }, () => g() * sigmaJour); };

test('volatilité constante de 1 % par séance : indice proche de 15,8', () => {
  const v = nervosite(serie(3000, 0.01)).valeur!;
  expect(Math.abs(v - 15.81) < 1.6, `obtenu ${v}`).toBe(true);
});

test('marché immobile : indice nul', () => {
  expect(nervosite(new Array(400).fill(0)).valeur).toBe(0);
});

test('historique insuffisant : pas de valeur', () => {
  expect(nervosite(serie(FENETRE_LENTE - 2, 0.01)).valeur).toBe(null);
  expect(nervosite(serie(FENETRE_LENTE, 0.01)).valeur).not.toBe(null);
});

test('la volatilité double : la composante rapide réagit avant la lente, l\'indice se place entre les deux', () => {
  const r = [...serie(1000, 0.005, 3), ...serie(40, 0.01, 4)];
  const avant = serieNervosite(r)[999]!;
  const apres = nervosite(r);
  expect(apres.valeur! > avant.valeur! * 1.2, 'l\'indice doit monter').toBe(true);
  expect(apres.rapide! > apres.lente!, 'la rapide dépasse la lente').toBe(true);
  expect(apres.valeur! < apres.rapide! && apres.valeur! > apres.lente!, 'l\'indice est entre les deux').toBe(true);
});

test('retour au calme : l\'indice redescend', () => {
  const r = [...serie(600, 0.005, 5), ...serie(30, 0.02, 6), ...serie(120, 0.005, 8)];
  const s = serieNervosite(r);
  expect(s[629]!.valeur! > s[599]!.valeur! * 1.5).toBe(true);
  expect(s[749]!.valeur! < s[629]!.valeur!).toBe(true);
});

test('une division du nominal (−50 % en une séance) est neutralisée', () => {
  const cours = [1000, 1010, 505, 510];
  const r = rendementsLog(cours);
  expect(r[1]).toBe(0);
  expect(Math.abs(r[0]! - Math.log(1.01)) < 1e-12).toBe(true);
});

test('cours nul ou manquant : rendement neutre, pas de NaN', () => {
  const r = rendementsLog([100, 0, 101, NaN, 102]);
  expect(r.every((x) => Number.isFinite(x))).toBe(true);
});

test('rendement du marché large : moyenne des titres cotés, les absents sont ignorés', () => {
  expect(rendementMarche([0.02, null, -0.01, null])).toBe(0.005);
  expect(rendementMarche([null, null])).toBe(0);
});

test('rang et régime', () => {
  const h = Array.from({ length: 100 }, (_, i) => i + 1);
  expect(rangHistorique(50, h)).toBe(50);
  expect(regime(10)).toBe('calme');
  expect(regime(50)).toBe('normal');
  expect(regime(80)).toBe('agité');
  expect(regime(96)).toBe('tendu');
});

test('rang glissant : fenêtre de 1 250 séances, 5 ans environ', () => {
  expect(FENETRE_RANG).toBe(1250);
  expect(MIN_RANG).toBe(250);
});

test('rang glissant : une valeur sortie de la fenêtre n’influe plus', () => {
  // Une seule valeur très haute en tête, puis 1 300 valeurs croissantes de 1 à 1 300.
  const valeurs = [1e9, ...Array.from({ length: 1300 }, (_, i) => i + 1)];
  const r = rangsGlissants(valeurs);
  // Dernière séance : la valeur 1e9 a quitté la fenêtre, 1 300 est la plus haute → 100.
  expect(r.at(-1)).toBe(100);
  // Tant que 1e9 est dans la fenêtre, la plus haute valeur récente n'atteint pas 100.
  expect(r[1249]!).toBeLessThan(100);
  // Avec la fenêtre de toute l'histoire, elle n'y arriverait jamais.
  const tout = rangsGlissants(valeurs, Infinity);
  expect(tout.at(-1)!).toBeLessThan(100);
});

test('rang glissant : la séance est comparée aux 1 250 dernières valeurs, elle comprise', () => {
  const valeurs = Array.from({ length: 2000 }, (_, i) => (i * 7919) % 1000);
  const r = rangsGlissants(valeurs);
  for (const i of [249, 1000, 1249, 1250, 1999]) {
    const fen = valeurs.slice(Math.max(0, i - FENETRE_RANG + 1), i + 1);
    expect(r[i]).toBe(rangHistorique(valeurs[i]!, fen));
  }
});

test('rang glissant : aucune valeur future', () => {
  const valeurs = Array.from({ length: 1600 }, (_, i) => Math.sin(i) * 10);
  const complet = rangsGlissants(valeurs);
  const tronque = rangsGlissants(valeurs.slice(0, 900));
  expect(complet.slice(0, 900)).toEqual(tronque);
});

test('rang glissant : pas de rang sous 250 valeurs, les absences ne comptent pas', () => {
  const valeurs: (number | null)[] = [null, null, ...Array.from({ length: 300 }, (_, i) => i)];
  const r = rangsGlissants(valeurs);
  expect(r[0]).toBeNull();
  expect(r[1]).toBeNull();
  // 249e valeur réelle (index 2 + 248) : pas encore de rang ; 250e : rang.
  expect(r[2 + 248]).toBeNull();
  expect(r[2 + 249]).toBe(100);
  expect(rangsGlissants([1, 2, 3])).toEqual([null, null, null]);
});
