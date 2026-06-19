// frontend/lib/forum/validation.test.ts
import { describe, it, expect } from 'vitest';
import { validateTopicInput, validatePostInput, resolveTopicLink } from './validation';

describe('validateTopicInput', () => {
  it('accepte un titre et un corps valides (trim appliqué)', () => {
    const r = validateTopicInput({ title: '  Avis sur SONATEL  ', body: 'Que pensez-vous des résultats ?' });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.title).toBe('Avis sur SONATEL'); }
  });
  it('rejette un titre trop court (< 5)', () => {
    expect(validateTopicInput({ title: 'abc', body: 'corps suffisant ici' }).ok).toBe(false);
  });
  it('rejette un titre trop long (> 140)', () => {
    expect(validateTopicInput({ title: 'a'.repeat(141), body: 'corps suffisant ici' }).ok).toBe(false);
  });
  it('rejette un corps trop court (< 10)', () => {
    expect(validateTopicInput({ title: 'Titre ok', body: 'court' }).ok).toBe(false);
  });
});

describe('validatePostInput', () => {
  it('accepte un corps valide', () => {
    expect(validatePostInput({ body: 'ok' }).ok).toBe(true);
  });
  it('rejette un corps vide après trim', () => {
    expect(validatePostInput({ body: '   ' }).ok).toBe(false);
  });
});

describe('resolveTopicLink', () => {
  it('catégorie instrument quand un code est fourni', () => {
    const r = resolveTopicLink({ instrumentCode: 'SNTS', eventId: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.category).toBe('instrument');
  });
  it('catégorie evenement quand un event est fourni', () => {
    const r = resolveTopicLink({ instrumentCode: null, eventId: 'e1' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.category).toBe('evenement');
  });
  it('catégorie general quand aucun rattachement', () => {
    const r = resolveTopicLink({ instrumentCode: null, eventId: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.category).toBe('general');
  });
  it('rejette un double rattachement (xor)', () => {
    expect(resolveTopicLink({ instrumentCode: 'SNTS', eventId: 'e1' }).ok).toBe(false);
  });
});
