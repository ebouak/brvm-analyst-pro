import { describe, expect, it } from 'vitest';
import { computeRenewsAt, prixDuCycle } from './dates';

const D = (s: string) => new Date(s + 'T10:00:00.000Z');

describe('computeRenewsAt', () => {
  it('mensuel : +1 mois', () => expect(computeRenewsAt(D('2026-09-22'), 'monthly').slice(0, 10)).toBe('2026-10-22'));
  it('trimestriel : +3 mois', () => expect(computeRenewsAt(D('2026-09-22'), 'quarterly').slice(0, 10)).toBe('2026-12-22'));
  it('annuel : +1 an', () => expect(computeRenewsAt(D('2026-09-22'), 'yearly').slice(0, 10)).toBe('2027-09-22'));
  it('trimestriel depuis le 30 novembre : report sur mars, jamais un jour en moins', () => {
    // 30 novembre + 3 mois = 30 février, qui n'existe pas → 1er ou 2 mars.
    const d = computeRenewsAt(D('2026-11-30'), 'quarterly').slice(0, 10);
    expect(d >= '2027-03-01' && d <= '2027-03-02').toBe(true);
  });
});

describe('prixDuCycle', () => {
  const premium = { price_monthly: 10000, price_quarterly: 25000, price_yearly: 90000 };
  it('rend le prix du cycle demandé', () => {
    expect(prixDuCycle(premium, 'monthly')).toBe(10000);
    expect(prixDuCycle(premium, 'quarterly')).toBe(25000);
    expect(prixDuCycle(premium, 'yearly')).toBe(90000);
  });
  it('rend null — et ne retombe JAMAIS sur un autre prix — quand le cycle n’existe pas', () => {
    expect(prixDuCycle({ price_monthly: 0, price_quarterly: null, price_yearly: 0 }, 'quarterly')).toBeNull();
  });
  it('l’échelle reste monotone : le mois coûte plus cher que le trimestre, qui coûte plus cher que l’an', () => {
    const parMois = { m: premium.price_monthly, t: premium.price_quarterly / 3, a: premium.price_yearly / 12 };
    expect(parMois.m).toBeGreaterThan(parMois.t);
    expect(parMois.t).toBeGreaterThan(parMois.a);
  });
});
