import { describe, it, expect } from 'vitest';
import { simulerReinvestissement, capitalPourObjectif } from './simulations';

describe('simulation pédagogique — réinvestissement des dividendes', () => {
  const lignes = simulerReinvestissement({ actions: 300, dpa: 1000, cours: 10_000, croissance_pct: 5, annees: 5 });

  it('année 1 : 300 actions × 1 000 FCFA = 300 000 ; réinvestis à 10 000, ils achètent 30 actions', () => {
    expect(lignes[0]).toMatchObject({
      annee: 1,
      dpa: 1000,
      cours: 10_000,
      actionsReinvest: 300,
      revenuReinvest: 300_000,
      actionsAchetees: 30,
      revenuEspeces: 300_000,
    });
  });

  it('année 2 : 330 actions × 1 050 FCFA = 346 500 (exemple de la leçon) ; conservés en espèces : 315 000', () => {
    expect(lignes[1]).toMatchObject({ annee: 2, dpa: 1050, actionsReinvest: 330, revenuReinvest: 346_500, revenuEspeces: 315_000 });
  });

  it('les actions s’achètent entières : le reliquat reste en espèces et sert l’année suivante', () => {
    for (const l of lignes) {
      expect(Number.isInteger(l.actionsAchetees)).toBe(true);
      expect(l.reliquat).toBeGreaterThanOrEqual(0);
      expect(l.reliquat).toBeLessThan(l.cours);
    }
  });

  it('le revenu réinvesti dépasse le revenu conservé dès la 2e année, jamais avant', () => {
    expect(lignes[0]!.revenuReinvest).toBe(lignes[0]!.revenuEspeces);
    for (const l of lignes.slice(1)) expect(l.revenuReinvest).toBeGreaterThan(l.revenuEspeces);
  });

  it('paramètres impossibles refusés', () => {
    expect(() => simulerReinvestissement({ actions: 300, dpa: 1000, cours: 0, croissance_pct: 5, annees: 5 })).toThrow();
    expect(() => simulerReinvestissement({ actions: 0, dpa: 1000, cours: 10_000, croissance_pct: 5, annees: 5 })).toThrow();
  });
});

describe('capital nécessaire pour un objectif de revenus', () => {
  it('600 000 FCFA par an : 10 000 000 à 6 %, 7 500 000 à 8 %', () => {
    expect(capitalPourObjectif(600_000, [6, 8])).toEqual([
      { rendementPct: 6, capital: 10_000_000 },
      { rendementPct: 8, capital: 7_500_000 },
    ]);
  });

  it('un rendement nul ou négatif n’a pas de sens : refusé', () => {
    expect(() => capitalPourObjectif(600_000, [0])).toThrow();
    expect(() => capitalPourObjectif(600_000, [-2])).toThrow();
  });
});
