import { describe, it, expect } from 'vitest';
import { rangNote, variationNote, dernieresNotations, libellePerspective, syntheseNotation, logoAgence } from './notation';

describe('notation', () => {
  it('rang et variation', () => {
    expect(rangNote('AA-')).toBeGreaterThan(rangNote('A+')!);
    expect(rangNote('ZZ')).toBeNull();
    expect(variationNote('AA-', 'A+')).toBe('hausse');
    expect(variationNote('A', 'AA')).toBe('baisse');
    expect(variationNote('AA-', 'AA-')).toBe('stable');
    expect(variationNote('AA-', undefined)).toBeNull();
  });
  it('trois dernières notations triées avec variation', () => {
    const e = [
      { note: 'A', date_notation: '2023-01-01' },
      { note: 'AA-', date_notation: '2025-01-01' },
      { note: 'A+', date_notation: '2024-01-01' },
      { note: 'BBB', date_notation: '2022-01-01' },
    ];
    const r = dernieresNotations(e);
    expect(r.map((x) => x.note)).toEqual(['AA-', 'A+', 'A']);
    expect(r.map((x) => x.variation)).toEqual(['hausse', 'hausse', 'hausse']);
  });
  it('perspective et synthèse', () => {
    expect(libellePerspective('stable')).toBe('Stable');
    expect(libellePerspective('NEGATIVE')).toBe('Négative');
    expect(libellePerspective(null)).toBe('');
    expect(syntheseNotation('AA-', 'Stable', [{ note: 'AA-' }, { note: 'AA-' }])).toBe(
      'Notation très haute qualité, perspective stable. Notation stable sur la période récente.',
    );
  });
  it('logo seulement si présent dans le dépôt', () => {
    expect(logoAgence('Bloomfield Investment')).toBe('/brand/bloomfield-logo.png');
    expect(logoAgence('Agusto & Co')).toBeNull();
  });
});
