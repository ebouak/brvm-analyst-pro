import { describe, it, expect } from 'vitest';
import { computeCombinedAlpha, computeGlobalRiskPenalty } from '@/lib/quant/combined-alpha';

describe('combined-alpha', () => {
  it('calcul complet', () => {
    const r = computeCombinedAlpha({ value:70,momentum:80,earningsQuality:60,financialStrength:65,dividendQuality:50},{globalRiskPenaltyInput:5, confidence:'high'});
    expect(r.score).not.toBeNull(); expect(r.score!).toBeGreaterThanOrEqual(0); expect(r.score!).toBeLessThanOrEqual(100);
  });
  it('redistribution si pilier manquant', () => {
    const r = computeCombinedAlpha({ value:null,momentum:80,earningsQuality:60,financialStrength:65,dividendQuality:50},{globalRiskPenaltyInput:0, confidence:'medium'});
    expect(r.redistribution).toBe(true); expect(r.score).not.toBeNull();
  });
  it('refus si >2 piliers manquent', () => {
    const r = computeCombinedAlpha({ value:null,momentum:80,earningsQuality:null,financialStrength:null,dividendQuality:50},{globalRiskPenaltyInput:0, confidence:'low'});
    expect(r.score).toBeNull();
  });
  it('penalité plafonnée 25', () => {
    expect(computeGlobalRiskPenalty({negativeEquity:true, consecutiveLosses:2, missingRecentFinancials:true})).toBeLessThanOrEqual(25);
  });
  it('low confidence ne donne pas Strong Buy', () => {
    const r = computeCombinedAlpha({ value:90,momentum:90,earningsQuality:90,financialStrength:90,dividendQuality:90},{globalRiskPenaltyInput:0, confidence:'low'});
    expect(r.classification).not.toBe('Strong Buy Quant');
  });
});
