import { describe, it, expect } from 'vitest';
import { parseSharesFromCapitalisation } from '../src/shares/sikafinance.js';

describe('parseSharesFromCapitalisation', () => {
  it('derive shares = capitalisation / cours', () => {
    expect(parseSharesFromCapitalisation(1_000_000_000_000, 20_000)).toBe(50_000_000);
  });
  it('retourne null si cours nul ou manquant', () => {
    expect(parseSharesFromCapitalisation(1_000_000, 0)).toBeNull();
    expect(parseSharesFromCapitalisation(null, 20_000)).toBeNull();
  });
  it('arrondit à l entier', () => {
    expect(parseSharesFromCapitalisation(1_000_050, 100)).toBe(10000);
  });
});
