// Tests du simulateur de budget. Exécuter : npx tsx lib/budgetSimulator.test.mjs
import assert from 'node:assert';
import { select, allocate, computeStrategy, STRATEGIES, IRVM } from './budgetSimulator.ts';

const meta = (k) => STRATEGIES.find((s) => s.key === k);

const UNIV = [
  { code: 'AAA', designation: 'Action A', secteur: 'Banque', prix: 10_000, rendement: 9, perf12: 2 },
  { code: 'BBB', designation: 'Action B', secteur: 'Banque', prix: 5_000, rendement: 4, perf12: 20 },
  { code: 'CCC', designation: 'Action C', secteur: 'Agro', prix: 2_000, rendement: 7, perf12: -3 },
  { code: 'DDD', designation: 'Action D', secteur: 'Télécoms', prix: 8_000, rendement: null, perf12: 15 },
];

// --- select : la stratégie « dividende » écarte l'action sans rendement -------
let s = select(UNIV, meta('div'), 5, false);
assert.ok(!s.some((a) => a.code === 'DDD'), 'DDD (rendement null) exclu de div');
assert.equal(s[0].code, 'AAA', 'meilleur rendement (9 %) en tête');

// --- select : « croissance » trie par perf12 ----------------------------------
s = select(UNIV, meta('cro'), 2, false);
assert.deepEqual(s.map((a) => a.code), ['BBB', 'DDD'], 'perf12 décroissante : BBB(20), DDD(15)');

// --- select diversify : une action par secteur d'abord ------------------------
s = select(UNIV, meta('div'), 2, true);
assert.equal(new Set(s.map((a) => a.secteur)).size, 2, 'deux secteurs distincts');

// --- allocate : quantités entières, frais inclus, reliquat réutilisé ----------
const sel = [UNIV[2]]; // CCC à 2 000, fee 0 → 1 000 000 / 2 000 = 500 titres
let lines = allocate(sel, 1_000_000, 0);
assert.equal(lines[0].qty, 500, '500 titres exactement');
assert.equal(lines[0].montant, 1_000_000, 'montant = 500 × 2 000');

// fee 25 % → coût unitaire 2 500 → 400 titres, pas 500
lines = allocate(sel, 1_000_000, 0.25);
assert.equal(lines[0].qty, 400, '400 titres avec 25 % de frais');

// --- computeStrategy : agrégats cohérents + IRVM ------------------------------
const r = computeStrategy(meta('div'), UNIV, 3, 1_000_000, 0.012, false, false);
assert.ok(r.investiTotal <= 1_000_000 + 1e-6, 'investi total ≤ budget');
assert.ok(Math.abs(r.investiTitres + r.frais - r.investiTotal) < 1e-6, 'titres + frais = total');
assert.ok(r.reste >= -1e-6, 'reste non négatif');
assert.equal(r.divNet, r.divBrut, 'sans IRVM : net = brut');

const rNet = computeStrategy(meta('div'), UNIV, 3, 1_000_000, 0.012, false, true);
assert.ok(Math.abs(rNet.divNet - rNet.divBrut * (1 - IRVM)) < 1e-6, 'IRVM appliqué (-10 %)');

// --- univers vide / budget nul : pas de plantage ------------------------------
assert.deepEqual(allocate([], 1_000_000, 0.01), [], 'sélection vide → aucune ligne');
assert.deepEqual(allocate(sel, 0, 0.01), [], 'budget nul → aucune ligne');

console.log('budgetSimulator.test.mjs ✓ tous les tests passent');
