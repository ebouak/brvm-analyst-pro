import { describe, it, expect } from 'vitest';
import { normaliserTelephone } from './telephone';

describe('normaliserTelephone', () => {
  it('accepte le format international avec espaces', () => {
    expect(normaliserTelephone('+225 07 07 12 34 56')).toEqual({ ok: true, e164: '+2250707123456' });
  });
  it('accepte le préfixe 00', () => {
    expect(normaliserTelephone('00221 77 123 45 67')).toEqual({ ok: true, e164: '+221771234567' });
  });
  it('ignore tirets, points et parenthèses', () => {
    expect(normaliserTelephone('+33 (7) 43.65-72-71')).toEqual({ ok: true, e164: '+33743657271' });
  });
  it("refuse un numéro sans indicatif (ambigu d'un pays à l'autre)", () => {
    expect(normaliserTelephone('07 07 12 34 56').ok).toBe(false);
  });
  it('refuse trop court ou trop long', () => {
    expect(normaliserTelephone('+225 123').ok).toBe(false);
    expect(normaliserTelephone('+1234567890123456').ok).toBe(false);
  });
  it('refuse les lettres', () => {
    expect(normaliserTelephone('+225 07 ABC').ok).toBe(false);
  });
  it('vide = rien à enregistrer', () => {
    expect(normaliserTelephone('   ')).toEqual({ ok: true, e164: null });
  });
});
