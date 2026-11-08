import { describe, it, expect } from 'vitest';
import { fmtFcfa } from './format';

describe('fmtFcfa', () => {
  it('convertit les téra en milliards (1,92e12 → 1 920 Md)', () => {
    expect(fmtFcfa(1.92e12).replace(/\s/g, ' ')).toBe('1 920 Md');
  });
  it('garde 2 décimales sous 1 000 Md', () => {
    expect(fmtFcfa(2.5e9)).toBe('2,50 Md');
  });
  it('ne produit jamais le suffixe T', () => {
    expect(fmtFcfa(3.456e12)).not.toMatch(/ T$/);
  });
});

describe('fmtFcfa sous le million', () => {
  it('affiche le montant entier, sans arrondi au millier', () => {
    expect(fmtFcfa(1500).replace(/\s/g, ' ')).toBe('1 500');
    expect(fmtFcfa(999999).replace(/\s/g, ' ')).toBe('999 999');
    expect(fmtFcfa(450)).toBe('450');
  });
  it('M à partir du million, Md à partir du milliard', () => {
    expect(fmtFcfa(1.5e6)).toBe('1,5 M');
    expect(fmtFcfa(1e9)).toBe('1,00 Md');
  });
});
