import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { signerRecap } from '../src/recap/telecharger.js';

describe('signerRecap (copie scraper)', () => {
  it('signe « u.exp » en HMAC-SHA256, comme la route du site l’attend', () => {
    const s = signerRecap('11111111-2222-3333-4444-555555555555', 'x'.repeat(40), 1_800_000_000);
    expect(s.exp).toBe(1_800_000_300);
    expect(s.sig).toBe(createHmac('sha256', 'x'.repeat(40)).update(`${s.u}.${s.exp}`).digest('hex'));
  });
  it('durée bornée à 10 minutes', () => {
    expect(signerRecap('u', 's', 0, 99_999).exp).toBe(600);
  });
});
