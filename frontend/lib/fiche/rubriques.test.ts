import { describe, expect, it } from 'vitest';
import { RUBRIQUES, rubriqueDepuis, rubriqueDeAncre, hrefRubrique } from './rubriques';

describe('rubriqueDepuis', () => {
  it('rend la vue d’ensemble par défaut', () => {
    expect(rubriqueDepuis(undefined)).toBe('vue-ensemble');
    expect(rubriqueDepuis('')).toBe('vue-ensemble');
  });
  it('accepte une rubrique connue', () => {
    expect(rubriqueDepuis('entreprise')).toBe('entreprise');
  });
  it('refuse une valeur inconnue', () => {
    expect(rubriqueDepuis('<script>')).toBe('vue-ensemble');
  });
  it('prend la première valeur d’un paramètre répété', () => {
    expect(rubriqueDepuis(['suivi', 'titre'])).toBe('suivi');
  });
});

describe('rubriqueDeAncre', () => {
  it('rattache les anciennes ancres à leur rubrique', () => {
    expect(rubriqueDeAncre('#liquidite')).toBe('aujourdhui');
    expect(rubriqueDeAncre('#dividendes')).toBe('entreprise');
    expect(rubriqueDeAncre('#valorisation')).toBe('entreprise');
    expect(rubriqueDeAncre('#these')).toBe('suivi');
    expect(rubriqueDeAncre('#essentiel')).toBe('vue-ensemble');
    expect(rubriqueDeAncre('#titre')).toBe('titre');
  });
  it('ignore une ancre inconnue ou vide', () => {
    expect(rubriqueDeAncre('#rubrique')).toBeNull();
    expect(rubriqueDeAncre('')).toBeNull();
  });
});

describe('hrefRubrique', () => {
  it('garde le paramètre de période et pose l’ancre de contenu', () => {
    expect(hrefRubrique('entreprise', '2025-01-01')).toBe('?rubrique=entreprise&from=2025-01-01#rubrique');
    expect(hrefRubrique('vue-ensemble', '')).toBe('?#rubrique');
  });
});

it('déclare cinq rubriques dans l’ordre de lecture', () => {
  expect(RUBRIQUES.map((r) => r.id)).toEqual(['vue-ensemble', 'aujourdhui', 'titre', 'entreprise', 'suivi']);
});
