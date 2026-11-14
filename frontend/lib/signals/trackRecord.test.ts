import { describe, it, expect } from 'vitest';
import { premieresEmissions, perfNette, FRAIS_ALLER_RETOUR_PCT } from './trackRecord';

describe('premieresEmissions', () => {
  it('BICB émis quatre fois en une semaine = un seul épisode, daté du premier jour', () => {
    const r = premieresEmissions([
      { code: 'BICB', date_marche: '2026-09-07' },
      { code: 'BICB', date_marche: '2026-09-04' },
      { code: 'BICB', date_marche: '2026-09-03' },
      { code: 'BOABF', date_marche: '2026-09-01' },
      { code: 'BICB', date_marche: '2026-09-01' },
    ]);
    expect(r).toHaveLength(2);
    expect(r.filter((x) => x.code === 'BICB')).toEqual([{ code: 'BICB', date_marche: '2026-09-01' }]);
  });
  it('un nouveau signal après plus de 30 jours ouvre un nouvel épisode', () => {
    const r = premieresEmissions([
      { code: 'A', date_marche: '2026-06-01' },
      { code: 'A', date_marche: '2026-06-20' },
      { code: 'A', date_marche: '2026-08-01' },
    ]);
    expect(r.map((x) => x.date_marche)).toEqual(['2026-08-01', '2026-06-01']);
  });
  it('l’épisode se prolonge tant que les signaux se suivent', () => {
    const r = premieresEmissions([
      { code: 'A', date_marche: '2026-06-01' },
      { code: 'A', date_marche: '2026-06-25' },
      { code: 'A', date_marche: '2026-07-20' },
    ]);
    expect(r).toHaveLength(1);
  });
});

describe('perfNette', () => {
  it('retire l’aller-retour de frais', () => {
    expect(perfNette(5)).toBeCloseTo(5 - FRAIS_ALLER_RETOUR_PCT);
    expect(perfNette(null)).toBeNull();
  });
});
