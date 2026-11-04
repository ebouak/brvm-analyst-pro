import { describe, it, expect } from 'vitest';
import { drapeau, slugDepuisNom, slugSgi, statistiquesSgi } from './identite';

describe('slugDepuisNom', () => {
  it('sans accent, sans sigle entre parenthèses, en minuscules à tirets', () => {
    expect(slugDepuisNom('Hudson & Cie')).toBe('hudson-cie');
    expect(slugDepuisNom('Finance Gestion et Intermédiation (FGI)')).toBe('finance-gestion-et-intermediation');
  });

  it('le slug de la base l’emporte sur celui dérivé du nom', () => {
    expect(slugSgi({ slug: 'fgi', nom: 'Finance Gestion et Intermédiation (FGI)' })).toBe('fgi');
    expect(slugSgi({ nom: 'SGI Togo' })).toBe('sgi-togo');
  });
});

describe('drapeau', () => {
  it('fichier local, jamais un domaine tiers', () => {
    expect(drapeau('CI')).toBe('/drapeaux/ci.svg');
    expect(drapeau('GW')).toBe('/drapeaux/gw.svg');
  });
});

describe('statistiquesSgi', () => {
  it('compte les pays réellement couverts, pas les membres de l’UEMOA', () => {
    const s = statistiquesSgi(
      [{ pays: 'CI' }, { pays: 'CI' }, { pays: 'SN' }],
      [
        { confiance: 'homologue_crepmf', sourceUrl: 'https://www.brvm.org/sites/default/files/x.pdf' },
        { confiance: 'homologue_crepmf', sourceUrl: 'https://www.richbourse.com/liste' },
        { confiance: 'agrege_public', sourceUrl: null },
      ],
    );
    expect(s).toEqual({ sgi: 3, pays: 2, baremesHomologues: 2, baremesAvecDecision: 1 });
  });
});
