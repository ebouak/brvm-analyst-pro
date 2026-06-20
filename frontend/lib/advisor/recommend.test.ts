import { describe, it, expect } from 'vitest';
import { recommend, type AdvisorInputs } from './recommend';

const base: AdvisorInputs = { signal: 'HOLD', confiance: 0.6, dcfUpside: null, rsi: null, dividendYield: null };

describe('recommend', () => {
  it('BUY fort + décote → Acheter avec conviction élevée', () => {
    const r = recommend({ signal: 'BUY', confiance: 0.9, dcfUpside: 0.3, rsi: 28, dividendYield: 6 });
    expect(r.action).toBe('acheter');
    expect(r.conviction).toBeGreaterThan(50);
    expect(r.reasons.length).toBeGreaterThan(1);
  });

  it('SELL + surcote → Vendre', () => {
    const r = recommend({ signal: 'SELL', confiance: 0.8, dcfUpside: -0.4, rsi: 75, dividendYield: null });
    expect(r.action).toBe('vendre');
    expect(r.score).toBeLessThan(0);
  });

  it('HOLD sans tilt → Conserver', () => {
    expect(recommend(base).action).toBe('conserver');
  });

  it('N INVENTE RIEN : facteurs null ignorés, factors compte les disponibles', () => {
    const r = recommend({ signal: 'BUY', confiance: null, dcfUpside: null, rsi: null, dividendYield: null });
    expect(r.factors).toBe(1); // seul le signal est dispo
    expect(r.action).toBe('acheter'); // 40*0.6 = 24 ≥ 22
  });

  it('aucune donnée → message explicite, conserver', () => {
    const r = recommend({ signal: null, confiance: null, dcfUpside: null, rsi: null, dividendYield: null });
    expect(r.factors).toBe(0);
    expect(r.action).toBe('conserver');
    expect(r.reasons[0]).toMatch(/insuffisantes/i);
  });

  it('décote DCF seule suffit à incliner vers Acheter', () => {
    const r = recommend({ signal: 'HOLD', confiance: 0.6, dcfUpside: 0.3, rsi: null, dividendYield: null });
    expect(r.score).toBeGreaterThanOrEqual(22);
    expect(r.action).toBe('acheter');
  });
});
