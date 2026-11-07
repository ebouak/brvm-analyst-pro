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
