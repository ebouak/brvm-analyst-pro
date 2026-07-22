import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLevels } from './levels.ts';
import { selectHebdo } from './select.ts';
import { buildSkeleton, assertNoForeignNumber } from './narrative.ts';
import { fmtMontant } from './format.ts';
import { pickNotableFundamental } from './fundamentals.ts';

/** Série croissante 40 → 79 (40 points). */
const croissante = Array.from({ length: 40 }, (_, i) => 40 + i);

test('computeLevels : résistance = plus haut des 20 séances précédentes', () => {
  const l = computeLevels(croissante);
  assert.equal(l.resistance, 78);
  assert.equal(l.cassureHaut, true);
  assert.equal(l.cassureBas, false);
});

test('computeLevels : support = plus bas du canal', () => {
  const l = computeLevels(croissante);
  assert.ok(l.support < l.resistance);
});

test('computeLevels : objectifs au-dessus de la résistance, invalidation sous le support', () => {
  const l = computeLevels(croissante);
  assert.ok(l.objectif1 > l.resistance);
  assert.ok(l.objectif2 > l.objectif1);
  assert.ok(l.invalidation < l.support);
});

test('computeLevels : historique trop court → null', () => {
  assert.equal(computeLevels([1, 2, 3]), null);
});

function cand(code, variation, volume, avgVolume, base = 100) {
  return {
    code,
    closes: Array.from({ length: 40 }, (_, i) => base + i * (variation >= 0 ? 1 : -1)),
    variationHebdo: variation,
    volume,
    avgVolume20: avgVolume,
  };
}

test('selectHebdo retient au plus 5 valeurs, triées par notabilité', () => {
  const picks = selectHebdo([
    cand('AAAA', 12, 3000, 1000), cand('BBBB', 9, 2500, 1000), cand('CCCC', 7, 1200, 1000),
    cand('DDDD', 5, 1100, 1000), cand('EEEE', 4, 1000, 1000), cand('FFFF', 3, 900, 1000),
    cand('GGGG', -8, 4000, 1000),
  ]);
  assert.ok(picks.length >= 3 && picks.length <= 5);
  assert.ok(picks[0].score >= picks[picks.length - 1].score);
});

test('selectHebdo garantit au moins une baisse si une baisse existe', () => {
  const picks = selectHebdo([
    cand('AAAA', 12, 3000, 1000), cand('BBBB', 11, 2900, 1000), cand('CCCC', 10, 2800, 1000),
    cand('DDDD', 9, 2700, 1000), cand('EEEE', 8, 2600, 1000), cand('ZZZZ', -3, 1100, 1000),
  ]);
  assert.ok(picks.some((p) => p.sens === 'baisse'), 'au moins une baisse attendue');
});

test('selectHebdo ignore un historique trop court', () => {
  const court = { code: 'SHRT', closes: [1, 2, 3], variationHebdo: 20, volume: 9999, avgVolume20: 10 };
  const picks = selectHebdo([court, cand('AAAA', 5, 2000, 1000), cand('BBBB', 4, 1500, 1000), cand('CCCC', 3, 1200, 1000)]);
  assert.ok(!picks.some((p) => p.code === 'SHRT'));
});

test('selectHebdo : volume anormal (≥2×) mentionné dans la raison', () => {
  const picks = selectHebdo([cand('AAAA', 6, 3000, 1000), cand('BBBB', 5, 1100, 1000), cand('CCCC', 4, 1050, 1000)]);
  const a = picks.find((p) => p.code === 'AAAA');
  assert.match(a.raison, /volume/i);
});

test('selectHebdo : aucune valeur exploitable → tableau vide', () => {
  assert.deepEqual(selectHebdo([]), []);
});

const metrics = {
  code: 'ETIT', dates: ['2026-07-20', '2026-07-21'], closes: [63, 66],
  rsi: [68, 69.8], dernier: 66, variationHebdo: 4.76, volume: 7600000,
  ratioVolume: 2.8, rsiDernier: 69.8, macdPositif: true,
  levels: { resistance: 63, support: 55, dernier: 66, cassureHaut: true, cassureBas: false, objectif1: 67, objectif2: 71, objectifBas1: 51, objectifBas2: 47, invalidation: 53 },
};

test('buildSkeleton produit des sections et une whitelist de chiffres', () => {
  const s = buildSkeleton(metrics);
  assert.ok(s.sections.length >= 3);
  assert.ok(s.chiffres.includes(69.8));
  assert.ok(s.chiffres.includes(66));
  assert.ok(s.verdict.length > 0);
});

test('buildSkeleton mentionne la cassure quand elle a lieu', () => {
  const s = buildSkeleton(metrics);
  const texte = s.sections.map((x) => x.texte).join(' ');
  assert.match(texte, /cassure|franchi/i);
});

test('assertNoForeignNumber accepte un texte n’utilisant que la whitelist', () => {
  assert.equal(assertNoForeignNumber('Le RSI atteint 69.8 et le cours 66 FCFA.', [69.8, 66]), true);
});

test('assertNoForeignNumber REJETTE un nombre inventé', () => {
  assert.equal(assertNoForeignNumber('Objectif à 120 FCFA.', [69.8, 66]), false);
});

test('assertNoForeignNumber tolère un arrondi proche', () => {
  assert.equal(assertNoForeignNumber('RSI de 70 environ.', [69.8]), true);
});

test('computeLevels expose aussi des objectifs BAISSIERS', () => {
  const l = computeLevels(croissante);
  assert.ok(l.objectifBas1 < l.support);
  assert.ok(l.objectifBas2 < l.objectifBas1);
});

test('le squelette est lui-meme accepte par son propre garde-fou', () => {
  // Regression : le texte contient « RSI(14) » et « 20 seances ». Sans ces
  // constantes dans la whitelist, toute reformulation fidele etait rejetee.
  const s = buildSkeleton(metrics);
  const texte = s.sections.map((x) => x.texte).join(' ');
  assert.equal(assertNoForeignNumber(texte, s.chiffres), true);
});

test('une valeur en BAISSE ne recoit jamais d objectif haussier', () => {
  // Regression : STAC avait rompu son support et se voyait annoncer un
  // « premier objectif » 32 % plus haut.
  const baisse = {
    ...metrics,
    variationHebdo: -6.57,
    levels: { resistance: 3200, support: 3050, dernier: 2985, cassureHaut: false, cassureBas: true,
              objectif1: 3275, objectif2: 3350, objectifBas1: 2975, objectifBas2: 2900, invalidation: 3012 },
  };
  const s = buildSkeleton(baisse);
  const niveaux = s.sections.find((x) => x.titre === 'Niveaux à surveiller').texte;
  assert.match(niveaux, /baisse/i);
  assert.ok(!niveaux.includes('3275'), 'aucun objectif haussier ne doit apparaitre');
  assert.ok(!niveaux.includes('3350'), 'aucun objectif haussier ne doit apparaitre');
  assert.equal(assertNoForeignNumber(niveaux, s.chiffres), true);
});

test('fmtMontant : milliards, millions, milliers', () => {
  assert.equal(fmtMontant(13075000000), '13,1 milliards FCFA');
  assert.equal(fmtMontant(-96558000), '96,6 millions FCFA');
  assert.equal(fmtMontant(1351000000), '1,4 milliard FCFA');
  assert.equal(fmtMontant(450000).replace(/[\s  ]/g, ' '), '450 000 FCFA');
});

test('fmtMontant : valeur absolue (le signe est porté par la phrase)', () => {
  assert.equal(fmtMontant(-13075000000), '13,1 milliards FCFA');
});

const perte = [{ periode: '2025', resultat_net: -96558000, benefice_par_action: null, dividende_par_action: null }];
// NB : benefice_par_action ajusté (100/95 → 150/142) — avec cours=3000 les
// valeurs d'origine donnaient un PER de 30 (> PER_HAUT=25), rendant ce cas
// notable au lieu de banal comme voulu par le test. Le reste (résultat net,
// dividende) est inchangé.
const banal = [
  { periode: '2025', resultat_net: 1000000000, benefice_par_action: 150, dividende_par_action: null },
  { periode: '2024', resultat_net: 950000000, benefice_par_action: 142, dividende_par_action: null },
];

test('pickNotableFundamental : une perte est toujours notable', () => {
  const f = pickNotableFundamental(perte, 3000);
  assert.ok(f);
  assert.match(f.phrase, /perte/i);
  assert.match(f.phrase, /96,6 millions/);
});

test('pickNotableFundamental : bond du benefice >= 30 %', () => {
  const rows = [
    { periode: '2025', resultat_net: 2000000000, benefice_par_action: 200, dividende_par_action: null },
    { periode: '2024', resultat_net: 1000000000, benefice_par_action: 100, dividende_par_action: null },
  ];
  const f = pickNotableFundamental(rows, 3000);
  assert.ok(f);
  assert.match(f.phrase, /progress/i);
});

test('pickNotableFundamental : PER bas (< 5)', () => {
  const rows = [{ periode: '2025', resultat_net: 5000000000, benefice_par_action: 1000, dividende_par_action: null }];
  const f = pickNotableFundamental(rows, 3000);
  assert.ok(f);
  assert.match(f.phrase, /fois les b[ée]n[ée]fices/i);
  assert.match(f.phrase, /bas/i);
});

test('pickNotableFundamental : rendement du dividende >= 6 %', () => {
  const rows = [{ periode: '2025', resultat_net: 5000000000, benefice_par_action: 300, dividende_par_action: 240 }];
  const f = pickNotableFundamental(rows, 3000);
  assert.ok(f);
  assert.match(f.phrase, /dividende/i);
});

test('pickNotableFundamental : cas banal → null (pas de remplissage)', () => {
  assert.equal(pickNotableFundamental(banal, 3000), null);
});

test('pickNotableFundamental : aucune donnee → null', () => {
  assert.equal(pickNotableFundamental([], 3000), null);
});
