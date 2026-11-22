import { describe, it, expect } from 'vitest';
import { valoriser } from './valoriserDirect';

const positions = [
  { code: 'SNTS', quantite: 10, prix_entree: 1000 },
  { code: 'ETIT', quantite: 100, prix_entree: 20 },
];

describe('valoriser', () => {
  it('calcule valeur, plus-value et totaux', () => {
    const v = valoriser(positions, { SNTS: 1100, ETIT: 25 }, 500);
    expect(v.lignes[0]).toEqual({ code: 'SNTS', last: 1100, cost: 10000, value: 11000, pnl: 1000, pnlPct: 10 });
    expect(v.totalCost).toBe(12000);
    expect(v.equityValue).toBe(13500);
    expect(v.totalValue).toBe(14000);
    expect(v.totalPnl).toBe(1500);
    expect(v.totalPnlPct).toBeCloseTo(0.125);
  });

  it("une ligne sans cours n'a pas de valeur mais son coût compte", () => {
    const v = valoriser(positions, { SNTS: 1100 }, null);
    expect(v.lignes[1]).toEqual({ code: 'ETIT', last: null, cost: 2000, value: null, pnl: null, pnlPct: null });
    expect(v.equityValue).toBe(11000);
    expect(v.totalPnl).toBe(-1000);
  });

  it('portefeuille vide : aucun pourcentage', () => {
    const v = valoriser([], {}, 1000);
    expect(v.totalValue).toBe(1000);
    expect(v.totalPnlPct).toBeNull();
  });
});
