import { describe, expect, it } from 'vitest';
import { formesNumero } from './stopNumero';

describe('formesNumero', () => {
  it('rend la forme E.164 et la forme en chiffres', () => {
    expect(formesNumero('+2250101010101')).toEqual(['+2250101010101', '2250101010101']);
    expect(formesNumero('225 01 01 01 01 01')).toEqual(['+2250101010101', '2250101010101']);
  });
  it('refuse le vide et les numéros invalides', () => {
    expect(formesNumero(null)).toEqual([]);
    expect(formesNumero('')).toEqual([]);
    expect(formesNumero('123')).toEqual([]);
    expect(formesNumero('0123456789')).toEqual([]);
  });
  it('ne laisse passer que chiffres et plus', () => {
    for (const f of formesNumero('+22501,(01)"x')) expect(f).toMatch(/^\+?\d+$/);
  });
});
