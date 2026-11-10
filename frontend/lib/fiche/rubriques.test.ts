import { describe, expect, it } from 'vitest';
import { RUBRIQUES, rubriqueDepuis, rubriqueDeAncre, hrefRubrique } from './rubriques';

describe('RUBRIQUES', () => {
  it('six rubriques de la note puis Mon suivi, à part', () => {
    expect(RUBRIQUES.map((r) => r.id)).toEqual(['synthese', 'societe', 'resultats', 'valorisation', 'marche', 'actualites', 'suivi']);
    expect(RUBRIQUES.filter((r) => r.groupe === 'perso').map((r) => r.id)).toEqual(['suivi']);
  });
  it('chaque rubrique porte une question', () => {
    for (const r of RUBRIQUES) expect(r.question.endsWith('?')).toBe(true);
  });
});

describe('rubriqueDepuis', () => {
  it('synthèse par défaut, valeur inconnue refusée', () => {
    expect(rubriqueDepuis(undefined)).toBe('synthese');
    expect(rubriqueDepuis('')).toBe('synthese');
    expect(rubriqueDepuis('<script>')).toBe('synthese');
  });
  it('accepte une rubrique connue et la première valeur répétée', () => {
    expect(rubriqueDepuis('resultats')).toBe('resultats');
    expect(rubriqueDepuis(['suivi', 'marche'])).toBe('suivi');
  });
  it('traduit les anciennes valeurs (liens partagés)', () => {
    expect(rubriqueDepuis('vue-ensemble')).toBe('synthese');
    expect(rubriqueDepuis('aujourdhui')).toBe('marche');
    expect(rubriqueDepuis('titre')).toBe('marche');
    expect(rubriqueDepuis('entreprise')).toBe('societe');
  });
});

describe('rubriqueDeAncre', () => {
  it('rattache les ancres héritées', () => {
    expect(rubriqueDeAncre('#liquidite')).toBe('marche');
    expect(rubriqueDeAncre('#carnet')).toBe('marche');
    expect(rubriqueDeAncre('#technique')).toBe('marche');
    expect(rubriqueDeAncre('#profil')).toBe('societe');
    expect(rubriqueDeAncre('#actionnariat')).toBe('societe');
    expect(rubriqueDeAncre('#fondamentaux')).toBe('resultats');
    expect(rubriqueDeAncre('#dividendes')).toBe('valorisation');
    expect(rubriqueDeAncre('#valorisation')).toBe('valorisation');
    expect(rubriqueDeAncre('#actualites-officielles')).toBe('actualites');
    expect(rubriqueDeAncre('#these')).toBe('suivi');
    expect(rubriqueDeAncre('#essentiel')).toBe('synthese');
  });
  it('ignore une ancre inconnue ou vide', () => {
    expect(rubriqueDeAncre('#rubrique')).toBeNull();
    expect(rubriqueDeAncre('')).toBeNull();
  });
});

describe('hrefRubrique', () => {
  it('garde la période, pose l’ancre de contenu ou une ancre précise', () => {
    expect(hrefRubrique('resultats', '2025-01-01')).toBe('?rubrique=resultats&from=2025-01-01#rubrique');
    expect(hrefRubrique('synthese', '')).toBe('?#rubrique');
    expect(hrefRubrique('marche', '', 'liquidite')).toBe('?rubrique=marche#liquidite');
  });
});
