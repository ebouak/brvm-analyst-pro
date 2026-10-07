import { describe, it, expect } from 'vitest';
import { lireValeur, arrondir, compatibles, rapprocher, cleRapprochement } from '../src/prudentiel/rapprochement.js';

const v = (t: string) => lireValeur(t)!;
const obs = (...textes: string[]) => textes.map((texte, i) => ({ id: `o${i}`, texte }));

describe('lecture de la précision publiée', () => {
  it('garde le nombre de décimales imprimées', () => {
    expect(v('16 %').decimales).toBe(0);
    expect(v('16,0 %').decimales).toBe(1);
    expect(v('16,00 %').decimales).toBe(2);
    expect(v('16,19%').entier).toBe(1619n);
    expect(v('1 234,5').entier).toBe(12345n);
  });
  it('illisible → null', () => {
    expect(lireValeur('environ 9 %')).toBeNull();
    expect(lireValeur('n.d.')).toBeNull();
  });
});

describe('arrondi décimal exact', () => {
  it('demi-unité arrondie en s’éloignant de zéro, sans erreur flottante', () => {
    expect(arrondir(v('1,005'), 2).entier).toBe(101n);
    expect(arrondir(v('16,19'), 1).entier).toBe(162n);
    expect(arrondir(v('15,79'), 1).entier).toBe(158n);
  });
});

describe('compatibilité à la précision la moins fine', () => {
  it.each([
    ['15,79', '15,8', true],
    ['16,19', '16,3', false],
    ['16,19', '16', true],
    ['16,3', '16', true],
    ['16,0', '16,00', true],
  ])('%s et %s → %s', (a, b, attendu) => {
    expect(compatibles(v(a), v(b))).toBe(attendu);
  });
});

describe('rapprochement d’un groupe', () => {
  it('SGBC 2023 : 15,8 et 15,79 → compatibles, la plus précise retenue', () => {
    const r = rapprocher(obs('15,8 %', '15,79 %'));
    expect(r.classe).toBe('rounding_compatible');
    expect(r.retenue).toBe('o1');
  });

  it('SGBC 2024 : 16,3, 16 et 16,19 → conflit ; 16 ne réconcilie rien', () => {
    const r = rapprocher(obs('16,3 %', '16 %', '16,19 %'));
    expect(r.classe).toBe('source_conflict');
    expect(r.retenue).toBeNull();
    expect(r.conflits).toEqual([['o0', 'o2']]);
  });

  it('une seule observation → unique', () => {
    expect(rapprocher(obs('19,64 %'))).toEqual({ classe: 'unique', retenue: 'o0', conflits: [] });
  });

  it('une valeur approchée non numérique rend le groupe illisible, jamais devinée', () => {
    expect(rapprocher(obs('14,9 %', 'aux alentours de 9 %')).classe).toBe('illisible');
  });

  it('tableau OCR mal aligné (valeur 2023 lue sous 2024) → conflit détecté', () => {
    // Présentation : 14,9 % en 2024 ; rapport annuel mal lu : 13,9 % (valeur 2023) sous l’en-tête 2024.
    expect(rapprocher(obs('14,9 %', '13,9 %')).classe).toBe('source_conflict');
  });
});

describe('homogénéité avant comparaison', () => {
  const base = { code: 'SGBC', indicateur: 'solvabilite_total', date_arrete: '2024-12-31', perimetre: 'individuel', unite: 'pct' };
  it('un changement de périmètre, de date ou d’unité sépare les groupes', () => {
    expect(cleRapprochement(base)).not.toBe(cleRapprochement({ ...base, perimetre: 'consolide' }));
    expect(cleRapprochement(base)).not.toBe(cleRapprochement({ ...base, date_arrete: '2023-12-31' }));
    expect(cleRapprochement(base)).not.toBe(cleRapprochement({ ...base, unite: 'millions_fcfa' }));
  });
});
