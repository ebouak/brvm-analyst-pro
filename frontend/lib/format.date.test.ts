import { describe, expect, it } from 'vitest';
import { fmtDateFR } from './format';

describe('fmtDateFR', () => {
  it('formate une date seule sans décalage de fuseau', () => {
    expect(fmtDateFR('2026-10-14')).toBe('14/10/2026');
  });
});
