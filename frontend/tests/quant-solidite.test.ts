import { describe, expect, it } from 'vitest';
import { buildRaw } from '@/lib/quant/run-buildraw';
import { computeFinancialStrengthScore } from '@/lib/quant/financial-strength';

const base = { inc: null, incPrev: null, incHistory: [], price: 1000, shares: 1_000_000, divRows: [] };

describe('buildRaw — solidité financière', () => {
  it('FCF : publié s’il existe, sinon flux d’exploitation − investissements (lignes publiées)', () => {
    const bal = { dette_court_terme: 100, dette_long_terme: 300, tresorerie_equivalents: 50, total_capitaux_propres: 1000 };
    const derive = buildRaw({ ...base, bal, cf: { flux_exploitation: 200, depenses_capital: -80 } });
    expect(derive.fcfToDebt).toBeCloseTo((200 - 80) / 400);
    const publie = buildRaw({ ...base, bal, cf: { flux_exploitation: 200, depenses_capital: -80, flux_tresorerie_disponible: 40 } });
    expect(publie.fcfToDebt).toBeCloseTo(40 / 400);
    expect(buildRaw({ ...base, bal, cf: { flux_exploitation: 200 } }).fcfToDebt).toBeNull();
  });

  it('banques : créances douteuses / crédits, couverture et liquidité publiées, croissance des dépôts', () => {
    const raw = buildRaw({
      ...base,
      bal: { lignes_specifiques: { credits_clientele: 2000, creances_douteuses: 100, taux_couverture_creances: 75, ratio_liquidite: 110, depots_clientele: 2200, ratio_solvabilite: 14 } },
      balPrev: { lignes_specifiques: { depots_clientele: 2000 } },
      cf: null,
    });
    expect(raw.nplRatio).toBeCloseTo(0.05);
    expect(raw.nplCoverage).toBe(75);
    expect(raw.liquidityRatio).toBe(110);
    expect(raw.depositGrowth).toBeCloseTo(0.1);
    expect(raw.capitalAdequacy).toBe(14);
  });

  it('la liquidité bancaire n’est JAMAIS le ratio courant d’une société industrielle', () => {
    const raw = buildRaw({ ...base, bal: { total_actif_circulant: 500, passif_courant: 250 }, cf: null });
    expect(raw.currentRatio).toBe(2);
    expect(raw.liquidityRatio).toBeNull();
  });
});

describe('computeFinancialStrengthScore — banques', () => {
  it('produit un score dès que les pairs bancaires existent', () => {
    const peers = {
      capitalAdequacy: [10, 12, 14, 16, 18],
      nplRatio: [0.03, 0.05, 0.08, 0.1, 0.12],
      nplCoverage: [50, 60, 70, 80, 90],
      liquidityRatio: [90, 100, 110, 120, 130],
      depositGrowth: [0, 0.05, 0.1, 0.15, 0.2],
    };
    const r = computeFinancialStrengthScore({
      sector: 'banks', capitalAdequacy: 16, nplRatio: 0.04, nplCoverage: 80, liquidityRatio: 120, depositGrowth: 0.12, peers,
    });
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeGreaterThan(50);
  });

  it('sans pairs bancaires (l’ancien défaut), le score reste vide', () => {
    const r = computeFinancialStrengthScore({ sector: 'banks', capitalAdequacy: 16, peers: {} });
    expect(r.score).toBeNull();
  });
});
