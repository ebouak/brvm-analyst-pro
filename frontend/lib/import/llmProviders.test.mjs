import assert from 'node:assert';
import { parseLlmJson, TEXT_PROVIDERS, VISION_PROVIDERS } from './llmProviders.ts';

// JSON pur
assert.deepEqual(parseLlmJson('{"revenue": 100}'), { revenue: 100 });
// JSON entouré de texte (fences)
assert.deepEqual(parseLlmJson('Voici le résultat:\n```json\n{"revenue": 100}\n```\nFin.'), { revenue: 100 });
// JSON avec préambule sans fence
assert.deepEqual(parseLlmJson('Réponse : {"a": 1, "b": null} merci'), { a: 1, b: null });
// invalide -> null
assert.equal(parseLlmJson('pas de json ici'), null);

// Ordre cascade
assert.deepEqual(TEXT_PROVIDERS, ['deepseek', 'mistral', 'grok']);
assert.deepEqual(VISION_PROVIDERS, ['mistral', 'grok']);

console.log('✓ llmProviders tests OK');
