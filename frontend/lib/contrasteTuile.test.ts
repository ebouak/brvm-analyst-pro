import { describe, expect, it } from 'vitest';
import { contraste, encreSur, tripletVersHex } from './contrasteTuile';

// Jetons réels (DESIGN.md §2) : bg et ivory, thème sombre puis clair.
const SOMBRE = ['#030303', '#fcfcfc'] as const;
const CLAIR = ['#faf8f4', '#201c17'] as const;

describe('contrasteTuile', () => {
  it('lit un triplet de jeton', () => {
    expect(tripletVersHex('3 3 3')).toBe('#030303');
    expect(tripletVersHex(' 252 252 252 ')).toBe('#fcfcfc');
    expect(tripletVersHex('rgb(1,2,3)')).toBeNull();
    expect(tripletVersHex('')).toBeNull();
  });

  it('choisit l\'encre foncée sur un vert vif, quel que soit l\'ordre du thème', () => {
    const vert = '#3fe18b';
    expect(encreSur(vert, SOMBRE)).toBe('#030303');
    expect(encreSur(vert, CLAIR)).toBe('#201c17');
  });

  it('choisit l\'encre claire sur un fond sombre', () => {
    const fondNeutre = '#1c2b30';
    expect(encreSur(fondNeutre, SOMBRE)).toBe('#fcfcfc');
    expect(encreSur(fondNeutre, CLAIR)).toBe('#faf8f4');
  });

  it('retient toujours l\'encre au meilleur contraste', () => {
    for (const fond of ['#b3261e', '#0a7844', '#ff6b6b', '#5a6266']) {
      for (const encres of [SOMBRE, CLAIR]) {
        const e = encreSur(fond, encres);
        const autre = e === encres[0] ? encres[1] : encres[0];
        expect(contraste(fond, e)).toBeGreaterThanOrEqual(contraste(fond, autre));
      }
    }
  });
});
