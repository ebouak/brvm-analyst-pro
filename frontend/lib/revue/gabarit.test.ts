import { describe, expect, it } from 'vitest';
import { planActivite, BUDGET_ACTIVITE } from './gabarit';

const it1 = (n: number) => ({ titre: 'T', detail: 'x'.repeat(n) });
describe('planActivite', () => {
  it('ne dépasse jamais le budget et ne tronque aucune puce', () => {
    const p = planActivite('s'.repeat(100), [it1(80), it1(80), it1(80)]);
    const total = (p.synthese?.length ?? 0) + p.items.reduce((a, i) => a + i.titre.length + i.detail.length, 0);
    expect(total).toBeLessThanOrEqual(BUDGET_ACTIVITE);
    expect(p.items.length).toBe(1);
    expect(p.omis).toBe(2);
  });
  it('écarte une synthèse trop longue au lieu de la couper', () => {
    const p = planActivite('s'.repeat(BUDGET_ACTIVITE + 1), [it1(50)]);
    expect(p.synthese).toBeNull();
    expect(p.items.length).toBe(1);
  });
});
