import { describe, expect, it } from 'vitest';
import { EMPTY_ACTIVITY_SNAPSHOT, evaluerMissions } from './missions';

describe('Academy missions pratiques (Lot #4)', () => {
  it('snapshot vide : 0 / 8 validées, pct = 0, première mission ciblée', () => {
    const res = evaluerMissions(EMPTY_ACTIVITY_SNAPSHOT);
    expect(res.total).toBe(8);
    expect(res.done).toBe(0);
    expect(res.pct).toBe(0);
    expect(res.nextMission?.id).toBe('n1-watchlist');
    expect(res.missions.every((m) => !m.complete && m.actuel === 0)).toBe(true);
  });

  it('snapshot partiel : borne actuel à cible et identifie la prochaine mission', () => {
    const res = evaluerMissions({
      watchlistCount: 7,
      paperAccountsCount: 1,
      paperOrdersCount: 2,
      alertsCount: 0,
      thesesCount: 0,
      portfolioPositionsCount: 1,
      passedExamsCount: 0,
    });
    const wl = res.missions.find((m) => m.id === 'n1-watchlist');
    const paperOrd = res.missions.find((m) => m.id === 'n2-paper-ordre');
    const paper3 = res.missions.find((m) => m.id === 'n3-paper-3-ordres');
    const pt = res.missions.find((m) => m.id === 'n4-portefeuille');

    expect(wl?.actuel).toBe(3);
    expect(wl?.complete).toBe(true);
    expect(paperOrd?.complete).toBe(true);
    expect(paper3?.actuel).toBe(2);
    expect(paper3?.complete).toBe(false);
    expect(pt?.actuel).toBe(1);
    expect(pt?.complete).toBe(false);
    expect(res.done).toBe(3);
    expect(res.pct).toBe(38);
    expect(res.nextMission?.id).toBe('n2-these');
  });

  it('snapshot complet : 8 / 8 validées, pct = 100, nextMission = null', () => {
    const res = evaluerMissions({
      watchlistCount: 5,
      paperAccountsCount: 2,
      paperOrdersCount: 4,
      alertsCount: 2,
      thesesCount: 1,
      portfolioPositionsCount: 5,
      passedExamsCount: 2,
    });
    expect(res.done).toBe(8);
    expect(res.pct).toBe(100);
    expect(res.nextMission).toBeNull();
    expect(res.missions.every((m) => m.complete)).toBe(true);
  });
});
