import { describe, it, expect } from 'vitest';
import { computeScore } from '../src/scoring/score.js';
import { ancienScore, entreeSeance, spearman, volumeMoyen30j, type LigneSeance } from '../src/signaux/rejeu.js';

const plat = Array.from({ length: 60 }, () => 100);

describe('rejeu du scoring', () => {
  it('ancien score : reproduit les deux erreurs mesurées le 2026-11-13', () => {
    // Volume faible à la hausse : l'ancienne formule le comptait comme une confirmation.
    const faible = computeScore({ code: 'V', closes: plat, variation_pct: 3, volume: 50, avg_volume_30d: 1000 });
    const fort = computeScore({ code: 'V', closes: plat, variation_pct: 3, volume: 20000, avg_volume_30d: 1000 });
    expect(ancienScore(faible)).toBeCloseTo(ancienScore(fort), 2);
    expect(faible.score_total).toBeLessThan(fort.score_total);
    // Titre immobile et illiquide : l'ancienne formule sortait −0,25.
    const immobile = computeScore({ code: 'L', closes: plat, variation_pct: 0, volume: 0, avg_volume_30d: 1000, liquidity_score: 0 });
    expect(ancienScore(immobile)).toBeCloseTo(-0.25, 4);
    expect(immobile.score_total).toBe(0);
  });

  it('volume moyen sur 30 jours calendaires, séance incluse', () => {
    const h: LigneSeance[] = [
      { code: 'X', date: '2026-01-01', cours: 1, variation_pct: 0, volume: 1000 },
      { code: 'X', date: '2026-01-20', cours: 1, variation_pct: 0, volume: 100 },
      { code: 'X', date: '2026-02-10', cours: 1, variation_pct: 0, volume: 300 },
    ];
    expect(volumeMoyen30j(h, 2)).toBe(200); // 01/01 hors fenêtre
    expect(entreeSeance(h, 2, 40).closes).toEqual([1, 1, 1]);
    expect(entreeSeance(h, 2, 40).liquidity_score).toBe(40);
  });

  it('Spearman : 1 si même ordre, −1 si ordre inverse, null sous 3 points', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 6);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 6);
    expect(spearman([1, 2], [1, 2])).toBeNull();
  });
});
