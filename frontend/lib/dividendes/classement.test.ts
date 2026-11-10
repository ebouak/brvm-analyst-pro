import { describe, expect, it } from 'vitest';
import { meilleursRendements } from './classement';

const l = (code: string, exercice: number | null, montant: number, rendement_pct: number | null) =>
  ({ code, exercice, montant, rendement_pct });

describe('meilleursRendements', () => {
  it("ne retient que l'exercice demandé", () => {
    const r = meilleursRendements([l('PALC', 2021, 1236, 16.3), l('PALC', 2025, 500, 6.6), l('SNTS', 2025, 160, 6.1)], 2025);
    expect(r.map((x) => x.code)).toEqual(['PALC', 'SNTS']);
    expect(r[0].rendement_pct).toBe(6.6);
  });

  it('garde une seule ligne par société, la plus élevée, sans additionner', () => {
    const r = meilleursRendements([l('ORAC', 2025, 704, 4.1), l('ORAC', 2025, 704, 4.1), l('ORAC', 2025, 800, 4.6)], 2025);
    expect(r).toHaveLength(1);
    expect(r[0].montant).toBe(800);
  });

  it('écarte les montants nuls et les rendements inconnus', () => {
    expect(meilleursRendements([l('FTSC', 2025, 0, 0), l('BOAC', 2025, 300, null)], 2025)).toEqual([]);
  });

  it('sans exercice, rien', () => {
    expect(meilleursRendements([l('SNTS', 2025, 160, 6.1)], null)).toEqual([]);
  });

  it('borne à n et départage par code', () => {
    const rows = ['E', 'D', 'C', 'B', 'A', 'F'].map((c) => l(c, 2025, 10, 5));
    expect(meilleursRendements(rows, 2025).map((x) => x.code)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});
