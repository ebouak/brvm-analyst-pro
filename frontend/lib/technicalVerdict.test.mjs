// Tests purs pour technicalVerdict — exécuter : npx tsx lib/technicalVerdict.test.mjs
import assert from 'node:assert';
import { technicalVerdict } from './technicalSummary.ts';

// Achat fort : majorité nette de haussiers.
let v = technicalVerdict({ bullCount: 6, bearCount: 0, neutCount: 1 });
assert.equal(v.tone, 'strong-buy');
assert.equal(v.label, 'Achat fort');
assert.ok(v.position > 0.8, `position attendue > 0.8, obtenu ${v.position}`);

// Vente forte : majorité nette de baissiers.
v = technicalVerdict({ bullCount: 0, bearCount: 5, neutCount: 1 });
assert.equal(v.tone, 'strong-sell');
assert.ok(v.position < 0.2, `position attendue < 0.2, obtenu ${v.position}`);

// Neutre : équilibre.
v = technicalVerdict({ bullCount: 2, bearCount: 2, neutCount: 3 });
assert.equal(v.tone, 'neutral');
assert.equal(v.position, 0.5);

// Achat modéré.
v = technicalVerdict({ bullCount: 3, bearCount: 1, neutCount: 3 });
assert.equal(v.tone, 'buy');

// Vente modérée.
v = technicalVerdict({ bullCount: 1, bearCount: 3, neutCount: 3 });
assert.equal(v.tone, 'sell');

// Aucun signal valide → neutre, aiguille au centre.
v = technicalVerdict({ bullCount: 0, bearCount: 0, neutCount: 0 });
assert.equal(v.tone, 'neutral');
assert.equal(v.position, 0.5);
assert.equal(v.score, 0);

console.log('✓ tous les tests passent');
