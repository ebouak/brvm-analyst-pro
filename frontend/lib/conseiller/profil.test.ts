import { describe, it, expect } from 'vitest';
import { profilDe, phraseDe, LIBELLE_PROFIL } from './profil';

describe('profilDe', () => {
  it('porteur : solde >= 2', () => {
    expect(profilDe({ tendance: 'haut', risque: 'haut', valorisation: 'milieu', qualite: 'milieu', rendement: null })).toBe('porteur');
    expect(profilDe({ tendance: 'haut', risque: 'haut', valorisation: 'haut', qualite: 'bas', rendement: 'milieu' })).toBe('porteur');
  });
  it('fragile : solde <= -2', () => {
    expect(profilDe({ tendance: 'bas', risque: 'bas', valorisation: 'milieu', qualite: 'milieu', rendement: 'milieu' })).toBe('fragile');
    expect(profilDe({ tendance: 'bas', risque: 'bas', valorisation: 'bas', qualite: 'haut', rendement: 'milieu' })).toBe('fragile');
  });
  it('partage : solde de -1 à 1', () => {
    expect(profilDe({ tendance: 'haut', risque: 'milieu', valorisation: 'milieu' })).toBe('partage');
    expect(profilDe({ tendance: 'bas', risque: 'milieu', valorisation: 'milieu' })).toBe('partage');
    expect(profilDe({ tendance: 'haut', risque: 'bas', valorisation: 'milieu' })).toBe('partage');
  });
  it('indetermine : moins de 2 familles non nulles', () => {
    expect(profilDe({ tendance: 'haut' })).toBe('indetermine');
    expect(profilDe({})).toBe('indetermine');
  });
});

describe('phraseDe', () => {
  it('construit favorables puis défavorables', () => {
    expect(phraseDe({ tendance: 'haut', rendement: 'haut', qualite: 'bas', risque: 'milieu' })).toBe(
      'Tendance forte face au marché, dividende élevé ; résultats et rentabilité faibles.',
    );
  });
  it('seulement favorables', () => {
    expect(phraseDe({ risque: 'haut', valorisation: 'haut' })).toBe('Peu volatile, se paie peu cher face à son secteur.');
  });
  it('seulement défavorables', () => {
    expect(phraseDe({ risque: 'bas', valorisation: 'bas' })).toBe('Volatile, se paie cher face à son secteur.');
  });
  it('aucun relief', () => {
    expect(phraseDe({ tendance: 'milieu', risque: 'milieu' })).toBe('Aucune famille ne se distingue de la cote.');
  });
  it('données insuffisantes', () => {
    expect(phraseDe({ tendance: 'haut', risque: null })).toBe('Données insuffisantes pour une lecture.');
  });
});

describe('LIBELLE_PROFIL', () => {
  it('libellés', () => {
    expect(LIBELLE_PROFIL.porteur).toBe('Profil porteur');
    expect(LIBELLE_PROFIL.indetermine).toBe('Lecture impossible');
  });
});
