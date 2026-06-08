import { describe, it, expect } from 'vitest';
import { checkBankSpecific } from '@/lib/import/fullGuardrails';

describe('checkBankSpecific', () => {
  it('accepte crédits + trésorerie <= total actif', () => {
    const r = checkBankSpecific({ credits_clientele: 8e11, tresorerie: 1e11, total_actifs: 1e12 });
    expect(r.ok).toBe(true);
  });
  it('rejette crédits + trésorerie nettement > total actif', () => {
    const r = checkBankSpecific({ credits_clientele: 2e12, tresorerie: 5e11, total_actifs: 1e12 });
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/banque/);
  });
  it('ignore le contrôle si une valeur manque', () => {
    const r = checkBankSpecific({ credits_clientele: null, tresorerie: 1e11, total_actifs: 1e12 });
    expect(r.ok).toBe(true);
  });
});
