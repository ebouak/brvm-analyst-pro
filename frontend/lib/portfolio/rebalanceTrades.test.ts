import { describe, it, expect } from 'vitest';
import { rebalanceTrades, longOnly, equalWeights, type RebalancePosition } from './rebalanceTrades';

const positions: RebalancePosition[] = [
  { code: 'A', value: 800_000, price: 1000 }, // 80%
  { code: 'B', value: 200_000, price: 500 }, // 20%
];

describe('longOnly', () => {
  it('ramène les poids négatifs à 0 et renormalise', () => {
    expect(longOnly([0.8, -0.2, 0.4])).toEqual([2 / 3, 0, 1 / 3]);
  });
  it('repli équipondéré si tout est négatif', () => {
    expect(longOnly([-1, -1])).toEqual([0.5, 0.5]);
  });
});

describe('equalWeights', () => {
  it('répartit également', () => {
    expect(equalWeights(4)).toEqual([0.25, 0.25, 0.25, 0.25]);
  });
});

describe('rebalanceTrades', () => {
  it('génère des ordres concrets vers la cible équipondérée', () => {
    const t = rebalanceTrades(positions, [0.5, 0.5], 3);
    // A : 80% → 50% : vendre 300 000 FCFA = 300 actions à 1000
    expect(t[0]).toMatchObject({ code: 'A', action: 'vendre', deltaValue: -300_000, deltaShares: -300 });
    // B : 20% → 50% : acheter 300 000 FCFA = 600 actions à 500
    expect(t[1]).toMatchObject({ code: 'B', action: 'acheter', deltaValue: 300_000, deltaShares: 600 });
  });

  it('respecte la bande de tolérance (drift < bande → conserver)', () => {
    const t = rebalanceTrades(positions, [0.82, 0.18], 3); // dérive 2pts < 3
    expect(t.every((x) => x.action === 'conserver')).toBe(true);
  });

  it('traite les poids négatifs comme long-only', () => {
    const t = rebalanceTrades(positions, [1.2, -0.2], 3); // → [1,0]
    expect(t[0].targetWeight).toBeCloseTo(1);
    expect(t[1].targetWeight).toBeCloseTo(0);
    expect(t[1].action).toBe('vendre');
  });

  it('renvoie [] si valeur totale nulle', () => {
    expect(rebalanceTrades([{ code: 'X', value: 0, price: 100 }], [1])).toEqual([]);
  });
});
