// Tests du barème de note A–F. Exécuter : npx tsx lib/rating.test.mjs
import assert from 'node:assert';
import { scoreToRating, MIN_CONFIDENCE } from './rating.ts';

// --- NR : score ou confiance manquants / confiance insuffisante -------------
assert.equal(scoreToRating(null, 0.9).note, 'NR');
assert.equal(scoreToRating(undefined, 0.9).note, 'NR');
assert.equal(scoreToRating(0.8, null).note, 'NR');
assert.equal(scoreToRating(0.8, 0.39).note, 'NR');
assert.equal(scoreToRating(0.8, 0.3).note, 'NR'); // neutralisation §9 (plafond 0.3)
assert.equal(scoreToRating(NaN, 0.9).note, 'NR');
assert.equal(scoreToRating(0.5, NaN).note, 'NR');

// --- Bornes du barème (confiance suffisante) ---------------------------------
const c = MIN_CONFIDENCE;
assert.equal(scoreToRating(1.0, c).note, 'A+');
assert.equal(scoreToRating(0.75, c).note, 'A+'); // borne incluse
assert.equal(scoreToRating(0.74, c).note, 'A');
assert.equal(scoreToRating(0.6, c).note, 'A'); // = BUY_THRESHOLD
assert.equal(scoreToRating(0.59, c).note, 'B+');
assert.equal(scoreToRating(0.3, c).note, 'B+');
assert.equal(scoreToRating(0.29, c).note, 'B');
assert.equal(scoreToRating(0.1, c).note, 'B');
assert.equal(scoreToRating(0.09, c).note, 'C');
assert.equal(scoreToRating(0, c).note, 'C');
assert.equal(scoreToRating(-0.09, c).note, 'C');
assert.equal(scoreToRating(-0.1, c).note, 'D'); // borne neutre exclue
assert.equal(scoreToRating(-0.59, c).note, 'D');
assert.equal(scoreToRating(-0.6, c).note, 'E'); // = SELL_THRESHOLD
assert.equal(scoreToRating(-1.0, c).note, 'E');

// --- Tons cohérents -----------------------------------------------------------
assert.equal(scoreToRating(0.8, 0.9).tone, 'up');
assert.equal(scoreToRating(0, 0.9).tone, 'neutral');
assert.equal(scoreToRating(-0.7, 0.9).tone, 'down');
assert.equal(scoreToRating(null, null).tone, 'muted');

console.log('✅ rating.test.mjs : tous les tests passent');
