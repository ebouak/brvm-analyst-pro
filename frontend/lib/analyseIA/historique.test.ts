import { describe, it, expect } from 'vitest';
import { resumerHistorique, dateDepuis } from './historique';
import type { PointCours } from './types';

const p = (date: string, cours: number, variation_pct: number | null = null, volume: number | null = 100): PointCours => ({
  date,
  cours,
  volume,
  variation_pct,
});

const serie: PointCours[] = [
  p('2024-12-30', 900, null),
  p('2025-01-02', 1000, 11.11),
  p('2025-06-02', 1200, 20),
  p('2025-12-31', 1100, -8.33),
  p('2026-01-05', 1050, -4.55),
  p('2026-11-06', 1300, 2.5, 300),
];

describe('résumé d’historique', () => {
  it('période réelle, extrêmes datés, variation', () => {
    const r = resumerHistorique(serie, null)!;
    expect(r.du).toBe('2024-12-30');
    expect(r.au).toBe('2026-11-06');
    expect(r.seances_cotees).toBe(6);
    expect(r.cours_debut).toBe(900);
    expect(r.cours_fin).toBe(1300);
    expect(r.variation_pct).toBeCloseTo(44.44, 2);
    expect(r.plus_haut).toEqual({ cours: 1300, date: '2026-11-06' });
    expect(r.plus_bas).toEqual({ cours: 900, date: '2024-12-30' });
    expect(r.volume_moyen).toBe(133);
  });
  it('découpage par année civile', () => {
    const r = resumerHistorique(serie, null)!;
    expect(r.par_annee.map((a) => a.annee)).toEqual([2024, 2025, 2026]);
    const a25 = r.par_annee.find((a) => a.annee === 2025)!;
    expect(a25).toMatchObject({ cours_debut: 1000, cours_fin: 1100, plus_haut: 1200, plus_bas: 1000, seances: 3 });
  });
  it('plus fortes séances lues sur la variation publiée', () => {
    const r = resumerHistorique(serie, null)!;
    expect(r.plus_fortes_hausses[0]).toEqual({ date: '2025-06-02', variation_pct: 20 });
    expect(r.plus_fortes_baisses[0]).toEqual({ date: '2025-12-31', variation_pct: -8.33 });
  });
  it('filtre par date de départ', () => {
    const r = resumerHistorique(serie, '2026-01-01')!;
    expect(r.du).toBe('2026-01-05');
    expect(r.seances_cotees).toBe(2);
    expect(r.historique_commence_le).toBe('2024-12-30');
  });
  it('moins de deux séances ⇒ null', () => {
    expect(resumerHistorique([p('2026-01-01', 10)], null)).toBeNull();
    expect(resumerHistorique(serie, '2027-01-01')).toBeNull();
  });
  it('ignore les cours nuls ou non finis', () => {
    const r = resumerHistorique([p('2026-01-01', 0), p('2026-01-02', 10), p('2026-01-03', 12)], null)!;
    expect(r.du).toBe('2026-01-02');
  });
  it('dateDepuis', () => {
    expect(dateDepuis('2026-11-08', 7)).toBe('2026-11-01');
    expect(dateDepuis('2026-11-08', null)).toBeNull();
  });
});
