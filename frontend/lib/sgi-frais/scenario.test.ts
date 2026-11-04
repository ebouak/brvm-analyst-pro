import { describe, it, expect } from 'vitest';
import { SCENARIO_DEFAUT, ecrireScenario, lienAvecScenario, lireScenario } from './scenario';

describe('scénario dans l’URL', () => {
  it('aller-retour : ce qui est écrit se relit à l’identique', () => {
    const s = { montant: 2_500_000, dureeAns: 3, nbAchats: 2, nbVentes: 1, montantParOrdre: 600_000 };
    expect(lireScenario(ecrireScenario(s))).toEqual(s);
  });

  it('le scénario par défaut ne produit aucun paramètre', () => {
    expect(ecrireScenario(SCENARIO_DEFAUT).toString()).toBe('');
  });

  it('une valeur hors bornes ou illisible retombe sur le défaut, jamais sur une valeur inventée', () => {
    const s = lireScenario(new URLSearchParams('capital=-5&duree=7&achats=99&ventes=abc&ordre=10'));
    expect(s).toEqual(SCENARIO_DEFAUT);
  });

  it('le lien garde le scénario et ajoute les paramètres demandés', () => {
    const s = { ...SCENARIO_DEFAUT, montant: 500_000 };
    expect(lienAvecScenario('/comparateur-sgi/comparer', s, { sgi: 'fgi,cgf-bourse' })).toBe('/comparateur-sgi/comparer?capital=500000&sgi=fgi%2Ccgf-bourse');
    expect(lienAvecScenario('/comparateur-sgi/simuler', SCENARIO_DEFAUT)).toBe('/comparateur-sgi/simuler');
  });
});
