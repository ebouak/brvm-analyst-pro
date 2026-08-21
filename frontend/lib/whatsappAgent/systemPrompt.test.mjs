// frontend/lib/whatsappAgent/systemPrompt.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt } from './systemPrompt.ts';

test('interdit explicitement le conseil en investissement', () => {
  const prompt = buildSystemPrompt({ watchlistCodes: [] });
  assert.match(prompt.toLowerCase(), /jamais.*conseil|conseil.*jamais/);
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
