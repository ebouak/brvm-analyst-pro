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
  const prompt = buildSystemPrompt({ watchlistCodes: [] });
  assert.match(prompt.toLowerCase(), /jamais.*conseil|conseil.*jamais/);
});

test('fournit un script de refus pour une demande directe d\'achat/vente', () => {
  const prompt = buildSystemPrompt({ watchlistCodes: [] });
  assert.match(prompt, /je ne peux pas te dire d'acheter ou de vendre/i);
});

test('interdit le Markdown standard et donne la syntaxe WhatsApp réelle', () => {
  const prompt = buildSystemPrompt({ watchlistCodes: [] });
  assert.match(prompt, /Markdown standard/i);
  assert.match(prompt, /\*gras\*/);
});

test('inclut la watchlist quand fournie', () => {
  const prompt = buildSystemPrompt({ watchlistCodes: ['SNTS', 'ETIT'] });
  assert.match(prompt, /SNTS/);
  assert.match(prompt, /ETIT/);
});

test("ne mentionne pas de watchlist quand elle est vide", () => {
  const prompt = buildSystemPrompt({ watchlistCodes: [] });
  assert.doesNotMatch(prompt, /Watchlist\s*:/);
});
