import assert from 'node:assert';
import { computeBilan } from './bilan.ts';

// « achat », référence 100, clôture 130 → +30 %, objectif atteint, verdict cohérent.
let b = computeBilan({ stance: 'achat', coursReference: 100, objectif: 120, coursCloture: 130 }, 'jouee');
assert.ok(Math.abs(b.performancePct - 0.30) < 1e-9, `+30 % attendu, eu ${b.performancePct}`);
assert.equal(b.objectifAtteint, 'oui');
assert.equal(b.verdictCoherent, true);

// « achat » clôturé « jouée » alors que le cours a chuté → incohérent.
b = computeBilan({ stance: 'achat', coursReference: 100, objectif: 120, coursCloture: 80 }, 'jouee');
assert.ok(b.performancePct < 0);
assert.equal(b.verdictCoherent, false, 'achat + baisse + jouée = incohérent');

// « vente » dont le cours baisse, verdict « jouée » → cohérent (baisse valide une vente).
b = computeBilan({ stance: 'vente', coursReference: 100, objectif: null, coursCloture: 80 }, 'jouee');
assert.equal(b.verdictCoherent, true, 'vente + baisse + jouée = cohérent');
assert.equal(b.objectifAtteint, 'sans-objet');

// Verdict « invalidee » : on ne juge pas la cohérence (l'utilisateur reconnaît son erreur).
b = computeBilan({ stance: 'achat', coursReference: 100, objectif: 120, coursCloture: 80 }, 'invalidee');
assert.equal(b.verdictCoherent, null, 'invalidee/abandonnee : cohérence non évaluée');

// Objectif non atteint.
b = computeBilan({ stance: 'achat', coursReference: 100, objectif: 150, coursCloture: 130 }, 'jouee');
assert.equal(b.objectifAtteint, 'non');

// Référence nulle → pas de division par zéro.
b = computeBilan({ stance: 'achat', coursReference: null, objectif: null, coursCloture: 130 }, 'jouee');
assert.equal(b.performancePct, null);
assert.equal(b.verdictCoherent, null, 'sans référence, pas de jugement de cohérence');

// Référence 0 → même protection.
b = computeBilan({ stance: 'achat', coursReference: 0, objectif: null, coursCloture: 130 }, 'jouee');
assert.equal(b.performancePct, null);

console.log('✓ journal/bilan OK');
