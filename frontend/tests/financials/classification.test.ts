import { describe, it, expect } from 'vitest';
import { FAMILLE_PAR_CODE } from '@/lib/financials/sectors';

describe('FAMILLE_PAR_CODE', () => {
  it('couvre exactement 48 sociétés', () => {
    expect(Object.keys(FAMILLE_PAR_CODE)).toHaveLength(48);
  });

  it('contient 15 banques et 33 général, 0 assurance', () => {
    const vals = Object.values(FAMILLE_PAR_CODE);
    expect(vals.filter((v) => v === 'banque')).toHaveLength(15);
    expect(vals.filter((v) => v === 'general')).toHaveLength(33);
    expect(vals.filter((v) => v === 'assurance')).toHaveLength(0);
  });

  it('toutes les valeurs sont des familles valides', () => {
    for (const v of Object.values(FAMILLE_PAR_CODE)) {
      expect(['banque', 'assurance', 'general']).toContain(v);
    }
  });
});
