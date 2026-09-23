import { describe, it, expect } from 'vitest';
import { seanceNarrative, orientation, type SeanceMetrics } from './seanceNarrative';

const S18: SeanceMetrics = {
  nbActions: 47, hausses: 8, baisses: 30, inchangees: 9, brvmCVar: 1.03,
  secteurs: [
    { secteur: 'Services financiers', variation_pct: -1.2, nb: 14 },
    { secteur: 'Industriels', variation_pct: -2.34, nb: 4 },
    { secteur: 'Télécoms', variation_pct: 3.95, nb: 2 },
    { secteur: 'Énergie', variation_pct: -0.5, nb: 1 },
  ],
  topHausse: { code: 'SNTS', variation: 7.49 }, topBaisse: { code: 'SDCC', variation: -7.48 }, plusEchangee: { code: 'SNTS', valeur: 2_761_000_000 },
};

describe('seanceNarrative — dérivé des chiffres, jamais rédigé', () => {
  it('séance du 18/09 : orientation baisse, secteurs les plus faibles nommés avec leur chiffre', () => {
    const n = seanceNarrative(S18);
    expect(orientation(S18)).toBe('baisse');
    expect(n.sousTitre).toBe('30 valeurs reculent, 8 progressent. La séance reste orientée à la baisse.');
    expect(n.accroche).toContain('30 valeurs reculent contre 8 en hausse');
    expect(n.corps).toContain('industriels (−2,34 %)');
    expect(n.corps).toContain('services financiers (−1,20 %)');
    expect(n.corps).not.toContain('nergie'); // nb = 1 : pas assez de titres pour parler d’un secteur
    expect(n.surveiller).toHaveLength(3);
    expect(n.surveiller[0]).toBe('SNTS signe la plus forte hausse (+7,49 %).');
  });
  it('ne parle jamais de publications à venir ni d’opportunités : rien en base ne les fonde', () => {
    const txt = JSON.stringify(seanceNarrative(S18));
    expect(txt).not.toMatch(/publication|opportunit|rebond/i);
  });
  it('séance vide : le dit, sans chiffres inventés', () => {
    const n = seanceNarrative({ ...S18, nbActions: 0, hausses: 0, baisses: 0, inchangees: 0, secteurs: [], topHausse: null, topBaisse: null, plusEchangee: null });
    expect(n.accroche).toBe('Aucune donnée de séance disponible.');
    expect(n.surveiller).toEqual([]);
  });
  it('séance en hausse : accroche et secteurs porteurs', () => {
    const n = seanceNarrative({ ...S18, hausses: 25, baisses: 10, secteurs: [{ secteur: 'Télécoms', variation_pct: 3.95, nb: 2 }] });
    expect(n.accroche).toContain('La hausse domine');
    expect(n.corps).toContain('portée par télécoms (+3,95 %)');
  });
});

describe('flash info', () => {
  it('trois puces dérivées, sans promesse', () => {
    const n = seanceNarrative(S18);
    expect(n.flash[0]).toBe('Baisse dominante : 30 valeurs reculent');
    expect(n.flash[1]).toContain('industriels (−2,34 %)');
    expect(n.flash[2]).toBe('SNTS concentre la plus forte valeur échangée');
  });
});
