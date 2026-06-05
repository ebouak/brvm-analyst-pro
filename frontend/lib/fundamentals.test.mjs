// Tests des calculs fondamentaux. Exécuter : npx tsx lib/fundamentals.test.mjs
import assert from 'node:assert';
import { computeRatios, assessQuality } from './fundamentals.ts';

// Cas plausible : SNTS-like
const r = computeRatios({
  cours: 20000, shares: 50_000_000,
  revenue: 1_400_000_000_000, net_income: 300_000_000_000,
  equity: 800_000_000_000, debt: 100_000_000_000, dividende: 1750,
});
assert.ok(Math.abs(r.per - 3.33) < 0.1, `PER ~3.33, got ${r.per}`);
assert.ok(Math.abs(r.roe - 0.375) < 0.01, `ROE ~0.375, got ${r.roe}`);
assert.ok(Math.abs(r.margeNette - 0.214) < 0.01, `marge ~0.214, got ${r.margeNette}`);
assert.ok(Math.abs(r.rendementDiv - 0.0875) < 0.001, `rdt div ~0.0875, got ${r.rendementDiv}`);

// Garde-fous : valeur aberrante FTSC (CA=3)
assert.equal(assessQuality('revenue', 3), 'suspect');
assert.equal(assessQuality('revenue', 1_400_000_000_000), 'ok');
assert.equal(assessQuality('per', -1.86), 'suspect');     // PER négatif
assert.equal(assessQuality('per', 8.5), 'ok');
assert.equal(assessQuality('margeNette', 2.0), 'suspect'); // marge > 100%
assert.equal(assessQuality('roe', 5.0), 'suspect');        // ROE > 200%
assert.equal(assessQuality('revenue', null), 'missing');

console.log('✓ fundamentals tests OK');
