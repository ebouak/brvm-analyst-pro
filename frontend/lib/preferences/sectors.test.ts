import { describe, it, expect } from 'vitest';
import { pickFavoriteSectorPerf } from './sectors';
import type { SectorPerf } from '@/lib/sectors';

const mk = (secteur: string): SectorPerf =>
  ({ secteur, varDay: 1, volumeDay: 0, topHausse: null, topBaisse: null, hausses: 0, baisses: 0, count: 0, sparkline30d: [] } as unknown as SectorPerf);

describe('pickFavoriteSectorPerf', () => {
  const perfs = [mk('Finance'), mk('Télécommunications'), mk('Énergie')];

  it('filtre sur les favoris et conserve l ordre des favoris', () => {
    const r = pickFavoriteSectorPerf(perfs, ['Énergie', 'Finance']);
    expect(r.map((p) => p.secteur)).toEqual(['Énergie', 'Finance']);
  });

  it('ignore un favori sans perf', () => {
    const r = pickFavoriteSectorPerf(perfs, ['Finance', 'Inconnu']);
    expect(r.map((p) => p.secteur)).toEqual(['Finance']);
  });

  it('liste de favoris vide → []', () => {
    expect(pickFavoriteSectorPerf(perfs, [])).toEqual([]);
  });
});
