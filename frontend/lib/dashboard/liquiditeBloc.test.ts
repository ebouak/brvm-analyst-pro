import { describe, it, expect } from 'vitest';
import { lignesLiquiditePositions, extremesLiquidite, fourchetteTexte, type LiquiditeSource } from './liquiditeBloc';
import { fmtNumber } from '@/lib/format';

const l = (code: string, score: number | null, o: Partial<LiquiditeSource> = {}): LiquiditeSource => ({
  code, score, classe: score == null ? null : score >= 75 ? 'A' : score >= 50 ? 'B' : score >= 25 ? 'C' : 'D',
  spread_pct: 0.5, spread_source: 'carnet', valeur_moyenne_30j: 10_000_000, ...o,
});

describe('fourchetteTexte', () => {
  it('« ≈ » seulement pour une estimation de Roll', () => {
    expect(fourchetteTexte(0.0111, 'carnet')).toBe(`${fmtNumber(0.0111, 2)} %`);
    expect(fourchetteTexte(1.5, 'roll')).toBe(`≈ ${fmtNumber(1.5, 2)} %`);
  });
  it('absente ou invalide : null', () => {
    expect(fourchetteTexte(null, null)).toBeNull();
    expect(fourchetteTexte(Number.NaN, 'carnet')).toBeNull();
    expect(fourchetteTexte(-1, 'carnet')).toBeNull();
  });
});

describe('lignesLiquiditePositions', () => {
  const liq = [l('SNTS', 100, { valeur_moyenne_30j: 1_025_739_186 }), l('SVOC', 4, { valeur_moyenne_30j: 0, spread_pct: null, spread_source: null }), l('UNLC', 10, { valeur_moyenne_30j: 1_000_000 })];

  it('durée théorique par position, alertes en tête, liquidités exclues', () => {
    const r = lignesLiquiditePositions(
      [{ code: 'SNTS', valeur: 4_500_000 }, { code: 'UNLC', valeur: 5_000_000 }, { code: 'LIQUIDITES', valeur: 100_000 }],
      liq,
    );
    expect(r.map((x) => x.code)).toEqual(['UNLC', 'SNTS']);
    expect(r[0]!.duree).toEqual({ seances: 25, alerte: true });
    expect(r[1]!.duree).toEqual({ seances: 1, alerte: false });
    expect(r[1]!.classe).toBe('A');
  });

  it('plusieurs lots du même titre : une ligne, valeur additionnée', () => {
    const r = lignesLiquiditePositions([{ code: 'SNTS', valeur: 2_000_000 }, { code: 'snts ', valeur: 3_000_000 }], liq);
    expect(r).toHaveLength(1);
    expect(r[0]!.valeurPosition).toBe(5_000_000);
    expect(r[0]!.duree).toEqual({ seances: 1, alerte: false });
  });

  it('un lot sans valeur rend le total inconnu, jamais sous-compté', () => {
    const r = lignesLiquiditePositions([{ code: 'SNTS', valeur: 2_000_000 }, { code: 'SNTS', valeur: null }], liq);
    expect(r).toHaveLength(1);
    expect(r[0]!.valeurPosition).toBeNull();
    expect(r[0]!.duree.seances).toBeNull();
  });

  it('valeur sans ligne ou sans moyenne : non mesurée, jamais 0', () => {
    const r = lignesLiquiditePositions([{ code: 'SVOC', valeur: 1_000_000 }, { code: 'ZZZZ', valeur: 1_000_000 }], liq);
    for (const x of r) {
      expect(x.duree.seances).toBeNull();
    }
    expect(r.find((x) => x.code === 'ZZZZ')!.mesuree).toBe(false);
    expect(r.find((x) => x.code === 'SVOC')!.valeurMoyenne30j).toBeNull();
  });
});

describe('extremesLiquidite', () => {
  it('cinq plus faciles, cinq plus difficiles, sans recouvrement', () => {
    const liq = Array.from({ length: 12 }, (_, k) => l(`V${k}`, k * 8));
    const e = extremesLiquidite(liq, 5);
    expect(e.faciles.map((x) => x.code)).toEqual(['V11', 'V10', 'V9', 'V8', 'V7']);
    expect(e.difficiles.map((x) => x.code)).toEqual(['V0', 'V1', 'V2', 'V3', 'V4']);
  });
  it('peu de valeurs : pas de doublon entre les deux listes ; scores nuls écartés', () => {
    const e = extremesLiquidite([l('A', 90), l('B', 50), l('C', 10), l('D', null)], 5);
    const tous = [...e.faciles, ...e.difficiles].map((x) => x.code);
    expect(new Set(tous).size).toBe(tous.length);
    expect(tous).not.toContain('D');
  });
});

describe('normalisations', () => {
  it('liquidités détectées malgré casse/espaces ; classe normalisée', () => {
    const r = lignesLiquiditePositions(
      [{ code: ' liquidites ', valeur: 1000 }, { code: 'SNTS', valeur: 1000 }],
      [l('SNTS', 60, { classe: ' b ' })],
    );
    expect(r).toHaveLength(1);
    expect(r[0].classe).toBe('B');
  });
});
