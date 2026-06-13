import { describe, it, expect } from 'vitest';
import { readTechnical } from './technical';
import { analyzeDividendTiming } from './dividendTiming';
import { readPosition } from './position';
import { synthesize } from './synthesis';

describe('readTechnical', () => {
  it('signale la tension surachat en tendance haussière (cas du screenshot)', () => {
    const r = readTechnical({ signal: 'SELL', rsi: 72, ma20: 18139, ma50: 15705, volumeRatio: 2.6, variationPct: 1.2 });
    expect(r.tone).toBe('mixed');
    expect(r.headline).toBe('Surachat en tendance haussière');
    expect(r.tension).toMatch(/correction technique/i);
    expect(r.points.some((p) => /surachat/i.test(p))).toBe(true);
    expect(r.points.some((p) => /haussière/i.test(p))).toBe(true);
  });

  it('configuration acheteuse franche sans tension', () => {
    const r = readTechnical({ signal: 'BUY', rsi: 28, ma20: 100, ma50: 90, volumeRatio: 1.0, variationPct: -1 });
    // survente + tendance haussière => pas de tension (oversold concerne trendDown)
    expect(r.tone).toBe('bullish');
    expect(r.tension).toBeNull();
  });

  it('survente en tendance baissière => mixed', () => {
    const r = readTechnical({ signal: 'BUY', rsi: 25, ma20: 90, ma50: 100, volumeRatio: 1, variationPct: 0 });
    expect(r.tone).toBe('mixed');
    expect(r.headline).toBe('Survente en tendance baissière');
  });
});

describe('analyzeDividendTiming', () => {
  const today = '2026-06-13';

  it('détachement à venir => baisse mécanique ≈ rendement', () => {
    const d = analyzeDividendTiming([{ montant: 620, ex_date: '2026-06-21', payment_date: null, exercice: 2025 }], 10000, today);
    expect(d.status).toBe('upcoming');
    expect(d.daysToEx).toBe(8);
    expect(d.yieldPct).toBeCloseTo(6.2, 1);
    expect(d.mechanicalDropPct).toBeCloseTo(6.2, 1);
    expect(d.verdict).toMatch(/capte le coupon/i);
  });

  it('détachement récent => baisse en partie mécanique', () => {
    const d = analyzeDividendTiming([{ montant: 500, ex_date: '2026-06-09', payment_date: null, exercice: 2025 }], 10000, today);
    expect(d.status).toBe('recent');
    expect(d.daysToEx).toBe(-4);
    expect(d.verdict).toMatch(/mécanique/i);
  });

  it('sans ex_date mais montant connu => historique, sans inventer de date', () => {
    const d = analyzeDividendTiming([{ montant: 700, ex_date: null, payment_date: null, exercice: 2024 }], 14000, today);
    expect(d.status).toBe('historical');
    expect(d.exDate).toBeNull();
    expect(d.yieldPct).toBeCloseTo(5, 1);
  });

  it('aucun dividende => none', () => {
    expect(analyzeDividendTiming([], 10000, today).status).toBe('none');
  });
});

describe('readPosition', () => {
  it('SELL + plus-value forte => sécuriser une partie', () => {
    const p = readPosition({ quantite: 10, prix_entree: 8000 }, 10000, 'SELL');
    expect(p.held).toBe(true);
    expect(p.latentPnlPct).toBeCloseTo(25, 0);
    expect(p.reading).toMatch(/sécuriser une partie/i);
  });

  it('SELL + moins-value => ne pas subir le signal', () => {
    const p = readPosition({ quantite: 5, prix_entree: 12000 }, 10000, 'SELL');
    expect(p.latentPnlPct).toBeLessThan(0);
    expect(p.reading).toMatch(/matérialiserait la perte/i);
  });

  it('non détenue + BUY => point d’entrée', () => {
    const p = readPosition(null, 10000, 'BUY');
    expect(p.held).toBe(false);
    expect(p.reading).toMatch(/point d’entrée/i);
  });
});

describe('synthesize', () => {
  const tech = readTechnical({ signal: 'SELL', rsi: 72, ma20: 18139, ma50: 15705, volumeRatio: 2.6, variationPct: 1.2 });

  it('priorise le contexte position quand l’utilisateur détient', () => {
    const position = readPosition({ quantite: 10, prix_entree: 8000 }, 10000, 'SELL');
    const dividend = analyzeDividendTiming([], 10000, '2026-06-13');
    const s = synthesize({ signal: 'SELL', confiance: 0.9, incomplet: false, technical: tech, position, dividend });
    expect(s.verdict).toMatch(/sécuriser une partie/i);
    expect(s.cautions.some((c) => /correction technique/i.test(c))).toBe(true);
  });

  it('met en garde sur la baisse mécanique post-détachement', () => {
    const position = readPosition(null, 10000, 'SELL');
    const dividend = analyzeDividendTiming([{ montant: 500, ex_date: '2026-06-09', payment_date: null, exercice: 2025 }], 10000, '2026-06-13');
    const s = synthesize({ signal: 'SELL', confiance: 0.8, incomplet: false, technical: tech, position, dividend });
    expect(s.cautions.some((c) => /mécanique/i.test(c))).toBe(true);
  });

  it('signal incomplet => pas de verdict tranché', () => {
    const position = readPosition(null, 10000, 'HOLD');
    const dividend = analyzeDividendTiming([], 10000, '2026-06-13');
    const s = synthesize({ signal: 'HOLD', confiance: 0.3, incomplet: true, technical: tech, position, dividend });
    expect(s.verdict).toMatch(/pas de signal fiable/i);
  });
});
