import { describe, it, expect } from 'vitest';
import { ratiosBilan } from './ratiosBilan';

// SUCRIVOIRE (SCRC) 2025, comptes SYSCOHADA.
const scrc = {
  cours: 1_000,
  titres: 19_600_000,
  resultatNet: -6_131_800_226,
  chiffreAffaires: 80_568_589_451,
  capitauxPropres: 13_822_035_189,
  detteFinanciere: 80_130_000_000,
  capitalisation: 33_712_000_000,
};

describe('ratiosBilan', () => {
  it('SCRC : P/B, ROE, dette/CP, BPA sur les comptes SYSCOHADA', () => {
    const r = ratiosBilan(scrc);
    expect(r.pb).toBeCloseTo(2.439, 2);
    expect(r.roe).toBeCloseTo(-0.4436, 3);
    expect(r.gearing).toBeCloseTo(5.797, 2);
    expect(r.bpa.valeur).toBe(-312.85);
  });
  it('perte : PER non calculable, avec son motif', () => {
    const r = ratiosBilan(scrc);
    expect(r.per.valeur).toBeNull();
    expect(r.per.motif).toBe('non calculable, perte');
  });
  it('bénéficiaire : PER = cours ÷ BPA', () => {
    const r = ratiosBilan({ cours: 3000, titres: 100, resultatNet: 30_000, chiffreAffaires: 100_000, capitauxPropres: 200_000, detteFinanciere: 50_000 });
    expect(r.bpa.valeur).toBe(300);
    expect(r.per.valeur).toBe(10);
    expect(r.capitalisation).toBe(300_000);
    expect(r.pb).toBeCloseTo(1.5, 5);
    expect(r.ps).toBeCloseTo(3, 5);
    expect(r.margeNette).toBeCloseTo(0.3, 5);
  });
  it('donnée absente : null, jamais zéro', () => {
    const r = ratiosBilan({ cours: null, titres: null, resultatNet: null, chiffreAffaires: null, capitauxPropres: null, detteFinanciere: null });
    expect(r.pb).toBeNull(); expect(r.roe).toBeNull(); expect(r.gearing).toBeNull();
    expect(r.bpa.valeur).toBeNull(); expect(r.per.valeur).toBeNull();
  });
  it('capitaux propres nuls ou négatifs : ratios de structure non calculés', () => {
    const r = ratiosBilan({ ...scrc, capitauxPropres: -5 });
    expect(r.pb).toBeNull(); expect(r.gearing).toBeNull();
  });
});
