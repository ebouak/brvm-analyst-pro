// frontend/lib/whatsappAgent/systemPrompt.test.mjs
//
// Ces tests garantissent que les instructions existent dans le texte du
// prompt — ils ne garantissent PAS que le LLM les respectera en production
// (impossible à tester unitairement). C'est la limite inhérente d'un test
// de prompt : nécessaire mais pas suffisant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt } from './systemPrompt.ts';

test('interdit explicitement le conseil en investissement', () => {
  const prompt = buildSystemPrompt({ watchlist: [] });
  assert.match(prompt.toLowerCase(), /jamais.*conseil|conseil.*jamais/);
});

test('fournit un script de refus pour une demande directe d\'achat/vente', () => {
  const prompt = buildSystemPrompt({ watchlist: [] });
  assert.match(prompt, /je ne peux pas te dire d'acheter ou de vendre/i);
});

test('interdit le Markdown standard et donne la syntaxe WhatsApp réelle', () => {
  const prompt = buildSystemPrompt({ watchlist: [] });
  assert.match(prompt, /Markdown standard/i);
  assert.match(prompt, /\*gras\*/);
});

test('inclut les vraies données de la watchlist quand fournies', () => {
  const prompt = buildSystemPrompt({
    watchlist: [
      { code: 'SNTS', cours: 15000, variationPct: 1.2, signal: 'BUY', confiance: 0.72 },
      { code: 'ETIT', cours: 8990, variationPct: -0.3, signal: 'HOLD', confiance: 0.6 },
    ],
  });
  assert.match(prompt, /SNTS.*15[\s ]?000.*FCFA/s);
  assert.match(prompt, /\+1\.20 %/);
  assert.match(prompt, /ETIT/);
  assert.match(prompt, /signal BUY/);
});

test("signale honnêtement une entrée sans donnée du jour, sans inventer de chiffre", () => {
  const prompt = buildSystemPrompt({
    watchlist: [{ code: 'XYZC', cours: null, variationPct: null, signal: null, confiance: null }],
  });
  assert.match(prompt, /XYZC : donnée du jour indisponible/);
});

test("ne mentionne pas de watchlist quand elle est vide", () => {
  const prompt = buildSystemPrompt({ watchlist: [] });
  assert.doesNotMatch(prompt, /Watchlist\s*:/);
});
