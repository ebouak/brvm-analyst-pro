import { describe, expect, it } from 'vitest';
import { debutScene, decouperTitre, sceneA, valeurCompteur } from './mouvement';

describe('valeurCompteur', () => {
  it('part du départ et finit exactement à la valeur', () => {
    expect(valeurCompteur(0, 1234.5, 0)).toBe(0);
    expect(valeurCompteur(0, 1234.5, 1)).toBe(1234.5);
    expect(valeurCompteur(0, 1234.5, 2)).toBe(1234.5);
  });
  it('est monotone et freine fort', () => {
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = valeurCompteur(0, 100, i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(valeurCompteur(0, 100, 0.5)).toBeGreaterThan(90);
  });
  it('gère une arrivée inférieure au départ', () => {
    expect(valeurCompteur(10, 0, 1)).toBe(0);
    expect(valeurCompteur(10, 0, 0.5)).toBeLessThan(10);
  });
});

describe('decouperTitre', () => {
  it('sépare l’accent de fin de titre', () => {
    const r = decouperTitre('Toute la BRVM. Au chiffre près.', 'Au chiffre près.');
    expect(r.principaux).toEqual(['Toute', 'la', 'BRVM.']);
    expect(r.accentues).toEqual(['Au', 'chiffre', 'près.']);
  });
  it('sans accent ou accent absent, tout est principal', () => {
    expect(decouperTitre('Un  titre simple').principaux).toEqual(['Un', 'titre', 'simple']);
    expect(decouperTitre('Un titre', 'autre').accentues).toEqual([]);
  });
});

describe('sceneA', () => {
  const sc = [{ duree: 4 }, { duree: 6 }, { duree: 10 }];
  it('trouve la scène et la progression', () => {
    expect(sceneA(sc, 0)).toMatchObject({ index: 0, progression: 0 });
    expect(sceneA(sc, 7)).toMatchObject({ index: 1, progression: 0.5 });
    expect(sceneA(sc, 19.99).index).toBe(2);
  });
  it('boucle', () => {
    expect(sceneA(sc, 20).index).toBe(0);
    expect(sceneA(sc, 27).index).toBe(1);
    expect(sceneA(sc, -1).index).toBe(2);
  });
  it('tolère une liste vide', () => {
    expect(sceneA([], 5).index).toBe(0);
  });
  it('donne le début d’une scène', () => {
    expect(debutScene(sc, 2)).toBe(10);
  });
});
