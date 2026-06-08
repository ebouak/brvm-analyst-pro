import { describe, it, expect } from 'vitest';
import { toRows } from '@/lib/import/fullPersist';
import type { YearStatement } from '@/lib/import/fullStatement';

const y: Partial<YearStatement> = {
  periode: '2025', revenu_total: 197629996000, resultat_net: 15508655000,
  total_capitaux_propres: 142638984000, tresorerie_equivalents: 9488637000,
  dette_long_terme: 796559000, total_actif_circulant: 86256798000, passif_courant: 55680750000,
  benefice_par_action: 760, dividende_par_action: 502, actions_en_circulation: 20406297,
  total_actifs: 199116293000, total_passif: 199116293000,
};

describe('toRows', () => {
  it('produit les 4 lignes (income, balance, cashflow, fundamentals) avec source', () => {
    const r = toRows('SLBC', y as YearStatement, 'fichier.pdf');
    expect(r.income.code).toBe('SLBC');
    expect(r.income.periode).toBe('2025');
    expect(r.income.type_periode).toBe('annuel');
    expect(r.income.revenu_total).toBe(197629996000);
    expect(r.balance.total_actifs).toBe(199116293000);
    expect(r.cashflow.code).toBe('SLBC');
    expect(r.fundamentals.year).toBe(2025);
    expect(r.fundamentals.revenue).toBe(197629996000);
    expect(r.fundamentals.bfr).toBe(86256798000 - 55680750000); // BFR = actif circ - passif courant
    expect(r.fundamentals.source).toBe('llm-extracted');
    expect(r.fundamentals.source_file).toBe('fichier.pdf');
  });

  it('répartit lignes_specifiques entre income et balance', () => {
    const withLs = { ...(y as YearStatement), lignes_specifiques: { pnb: 5e11, depots_clientele: 2e12 } };
    const r = toRows('NSBC', withLs, 'f.pdf');
    expect((r.income.lignes_specifiques as Record<string, number>).pnb).toBe(5e11);
    expect((r.balance.lignes_specifiques as Record<string, number>).depots_clientele).toBe(2e12);
    expect((r.income.lignes_specifiques as Record<string, unknown>).depots_clientele).toBeUndefined();
  });
});
