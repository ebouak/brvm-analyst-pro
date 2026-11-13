import { describe, it, expect } from 'vitest';
import { lireNombreMembres } from '../src/communaute/runCommunaute.js';

describe('lireNombreMembres', () => {
  it('lit le nombre renvoyé par Telegram', () => expect(lireNombreMembres({ ok: true, result: 142 })).toBe(142));
  it('refuse une réponse en échec, en relayant la description', () =>
    expect(() => lireNombreMembres({ ok: false, description: 'Bad Request: chat not found' })).toThrow(/chat not found/));
  it('refuse un nombre absent ou négatif', () => {
    expect(() => lireNombreMembres({ ok: true })).toThrow();
    expect(() => lireNombreMembres({ ok: true, result: -3 })).toThrow();
    expect(() => lireNombreMembres(null)).toThrow();
  });
});
