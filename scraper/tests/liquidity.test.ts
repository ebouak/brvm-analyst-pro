import { describe, it, expect } from 'vitest';
import { computeLiquidityV2, classifyLiquidity, type LiquiditySessionRow30 } from '../src/liquidity/compute.js';
import { computeSessionFlow, type FlowSnapshot } from '../src/liquidity/flow.js';

/** n séances traitées identiques : cours 5000, variation 0.5 %, valeur `valeur` FCFA. */
function rows(n: number, valeur: number, variation = 0.5): LiquiditySessionRow30[] {
  return Array.from({ length: n }, (_, i) => ({
    date_marche: `2026-06-${String(i + 1).padStart(2, '0')}`,
    cours_jour: 5000, variation_pct: variation, volume: Math.round(valeur / 5000), valeur_echangee: valeur,
  }));
}

describe('computeLiquidityV2', () => {
  it('retourne score null sous 10 séances de marché', () => {
    const r = computeLiquidityV2(rows(5, 1_000_000), 5);
    expect(r.score).toBeNull();
    expect(r.classe).toBeNull();
    expect(r.seances_marche).toBe(5);
  });

  it('titre jamais traité → classe D, présence 0', () => {
    const vides: LiquiditySessionRow30[] = [];
    const r = computeLiquidityV2(vides, 30);
    expect(r.presence_pct).toBe(0);
    expect(r.score).not.toBeNull();
    expect(r.classe).toBe('D');
  });

  it('titre très actif (30/30 séances, 50 M/séance) score élevé, amihud faible', () => {
    const r = computeLiquidityV2(rows(30, 50_000_000), 30);
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.amihud).not.toBeNull();
    expect(r.amihud!).toBeLessThan(1);
  });

  it('amihud discrimine : même présence, gros impact prix → score plus bas', () => {
    const liquide = computeLiquidityV2(rows(30, 50_000_000, 0.2), 30);
    const illiquide = computeLiquidityV2(rows(30, 500_000, 5), 30);
    expect(illiquide.score!).toBeLessThan(liquide.score!);
    expect(illiquide.amihud!).toBeGreaterThan(liquide.amihud!);
  });

  it('valeur_echangee null (source brvm.org) → fallback cours×volume, amihud calculé', () => {
    const sansValeur = rows(30, 5_000_000).map((r) => ({ ...r, valeur_echangee: null }));
    const r = computeLiquidityV2(sansValeur, 30);
    expect(r.amihud).not.toBeNull();
    expect(r.valeur_moyenne_30j).toBeGreaterThan(0);
  });

  it('Roll : série alternante → spread estimé > 0 ; tendance pure → null (composante neutre)', () => {
    const alternant = rows(30, 5_000_000).map((r, i) => ({ ...r, cours_jour: i % 2 === 0 ? 5000 : 5050 }));
    const tendance = rows(30, 5_000_000).map((r, i) => ({ ...r, cours_jour: 5000 + i * 10 }));
    const a = computeLiquidityV2(alternant, 30);
    const t = computeLiquidityV2(tendance, 30);
    expect(a.spread_roll_pct).not.toBeNull();
    expect(a.spread_roll_pct!).toBeGreaterThan(0);
    expect(t.spread_roll_pct).toBeNull();
  });
});

describe('classifyLiquidity', () => {
  it('seuils A/B/C/D', () => {
    expect(classifyLiquidity(75)).toBe('A');
    expect(classifyLiquidity(50)).toBe('B');
    expect(classifyLiquidity(25)).toBe('C');
    expect(classifyLiquidity(24)).toBe('D');
  });
});

function snap(t: string, close: number, volume: number): FlowSnapshot {
  return { captured_at: `2026-07-17T${t}:00Z`, close, volume };
}

describe('computeSessionFlow', () => {
  it('null si moins de 2 snapshots', () => {
    expect(computeSessionFlow([])).toBeNull();
    expect(computeSessionFlow([snap('09:00', 5000, 100)])).toBeNull();
  });

  it('tick rule : hausse → achat, baisse → vente, plat → neutre', () => {
    const f = computeSessionFlow([
      snap('09:00', 5000, 0),
      snap('09:15', 5050, 100),
      snap('09:30', 5050, 150),
      snap('09:45', 5000, 250),
    ])!;
    expect(f.volume_achat).toBe(100);
    expect(f.volume_neutre).toBe(50);
    expect(f.volume_vente).toBe(100);
    expect(f.flux_net_pct).toBe(0);
  });

  it('volume cumulé non monotone (correction de séance) → delta clampé à 0', () => {
    const f = computeSessionFlow([snap('09:00', 5000, 200), snap('09:15', 5100, 150)])!;
    expect(f.volume_achat).toBe(0);
    expect(f.flux_net_pct).toBeNull();
  });

  it('désordre chronologique toléré (tri interne)', () => {
    const f = computeSessionFlow([snap('09:15', 5050, 100), snap('09:00', 5000, 0)])!;
    expect(f.volume_achat).toBe(100);
  });
});
