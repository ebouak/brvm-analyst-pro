import { describe, it, expect } from 'vitest';
import { computeValuation } from './valuation';
import type { FundamentalRatios } from './types';

const base = (o: Partial<FundamentalRatios>): FundamentalRatios => ({
  capitalisation: null, bpa: null, rendement_dividende: null, per: null, pb: null, ps: null, roe: null, marge_nette: null,
  dette_sur_capitaux_propres: null, payout: null, croissance_ca: null, croissance_rn: null,
  cours_bas_52s: null, cours_haut_52s: null, cours_actuel: null, ...o,
} as FundamentalRatios);

describe('computeValuation', () => {
  it('perte : le sous-score PER et Graham sont ignorés, seul le P/B compte', () => {
    const v = computeValuation(base({ bpa: -312.85, per: -5.5, pb: 2, cours_actuel: 1720 }), 1720, null, 19_600_000);
    expect(v.grahamNumber).toBeNull();
    expect(v.marginOfSafety).toBeNull();
    // P/B 2 -> (3-2)/2*100 = 50, seul sous-score retenu
    expect(v.scoreValorisation).toBeCloseTo(50, 5);
  });
  it('PER négatif sans BPA connu : ignoré aussi', () => {
    const v = computeValuation(base({ bpa: null, per: -3, pb: null }), 1000, null, 1);
    expect(v.scoreValorisation).toBeNull();
  });
  it('bénéfice positif : PER pris en compte', () => {
    const v = computeValuation(base({ bpa: 100, per: 15, pb: 1 }), 1500, null, 1);
    expect(v.scoreValorisation).not.toBeNull();
    expect(v.grahamNumber).not.toBeNull();
  });
});
