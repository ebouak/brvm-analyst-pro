import { describe, it, expect } from 'vitest';
import { derniersReleves, type ReleveCommunaute } from './communaute';

const auj = new Date('2026-11-13T12:00:00Z');
const r = (reseau: ReleveCommunaute['reseau'], releve_le: string, abonnes: number): ReleveCommunaute => ({ reseau, releve_le, abonnes, source: 'manuel' });

describe('derniersReleves', () => {
  it('garde le relevé le plus récent de chaque réseau, dans l’ordre fixe', () => {
    const out = derniersReleves([r('telegram', '2026-11-10', 80), r('tiktok', '2026-11-01', 500), r('telegram', '2026-11-12', 85)], auj);
    expect(out.map((x) => [x.reseau, x.abonnes])).toEqual([['tiktok', 500], ['telegram', 85]]);
  });
  it('un réseau sans relevé n’apparaît pas', () => {
    expect(derniersReleves([r('linkedin', '2026-11-12', 40)], auj).map((x) => x.reseau)).toEqual(['linkedin']);
  });
  it('écarte un relevé périmé plutôt que de le présenter comme actuel', () => {
    expect(derniersReleves([r('facebook', '2026-09-01', 900)], auj)).toEqual([]);
  });
  it('écarte un nombre négatif ou non fini', () => {
    expect(derniersReleves([r('tiktok', '2026-11-12', -1), r('linkedin', '2026-11-12', Number.NaN)], auj)).toEqual([]);
  });
});
