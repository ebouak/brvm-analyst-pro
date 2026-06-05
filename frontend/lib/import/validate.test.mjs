import assert from 'node:assert';
import { validateExtraction } from './validate.ts';

// Tout plausible -> auto
const okRes = validateExtraction({
  revenue: 1_923_100, net_income: 413_588, equity: 1_399_263,
  debt_total: null, cash: null, eps: 3420, dividend_per_share: null, shares_outstanding: 100_000_000,
});
assert.equal(okRes.status, 'auto', `attendu auto, eu ${okRes.status}`);
assert.equal(okRes.suspects.length, 0);

// Valeur aberrante (CA=3 en millions => en FCFA 3M, < 1Md => suspect)
const badRes = validateExtraction({
  revenue: 3, net_income: 1000, equity: 5000,
  debt_total: null, cash: null, eps: null, dividend_per_share: null, shares_outstanding: null,
});
assert.equal(badRes.status, 'review', `attendu review, eu ${badRes.status}`);
assert.ok(badRes.suspects.includes('revenue'), 'revenue doit être suspect');

console.log('✓ validate tests OK');
