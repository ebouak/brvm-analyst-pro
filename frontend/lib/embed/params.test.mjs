// Exécuter : cd frontend && npx tsx lib/embed/params.test.mjs
import assert from 'node:assert';
import { parseTheme, parseLang, parseCodes, MAX_CODES } from './params.ts';

// Thème : dark par défaut, valeur inconnue → dark.
assert.equal(parseTheme(undefined), 'dark');
assert.equal(parseTheme('light'), 'light');
assert.equal(parseTheme('LIGHT'), 'light');
assert.equal(parseTheme('fluo'), 'dark');

// Langue : fr par défaut, valeur inconnue → fr.
assert.equal(parseLang(undefined), 'fr');
assert.equal(parseLang('en'), 'en');
assert.equal(parseLang('EN'), 'en');
assert.equal(parseLang('de'), 'fr');

// Codes : absent/vide → null (= toutes les actions).
assert.equal(parseCodes(undefined), null);
assert.equal(parseCodes(''), null);
assert.equal(parseCodes('  ,  '), null);

// Codes : normalisés en majuscules, espaces retirés, doublons écartés.
assert.deepEqual(parseCodes('snts, etit ,SNTS'), ['SNTS', 'ETIT']);

// Codes : plafonné à MAX_CODES — sans borne, un tiers fait exploser la requête.
const trop = Array.from({ length: MAX_CODES + 10 }, (_, i) => `C${i}`).join(',');
assert.equal(parseCodes(trop).length, MAX_CODES);

console.log('✓ params.test.mjs : tous les tests passent');
