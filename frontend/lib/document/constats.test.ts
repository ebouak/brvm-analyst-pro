import { describe, expect, it } from 'vitest';
import { constatSerie, constatCouverture, constatValorisation } from './constats';

const sp = (s: string | null) => s?.replace(/[  ]/g, ' ') ?? null;
const pts = (vals: (number | null)[], debut = 2021) => vals.map((v, i) => ({ exercice: String(debut + i), valeur: v }));

describe('constatSerie', () => {
  it('quatre hausses consécutives', () => {
    expect(sp(constatSerie("Chiffre d'affaires", pts([100, 110, 120, 130, 140.83], 2020))))
      .toBe("Chiffre d'affaires : +8,3 % en 2024, quatrième hausse consécutive");
  });
  it('rupture : pas de série annoncée', () => {
    expect(sp(constatSerie('Résultat net', pts([100, 90, 99])))).toBe('Résultat net : +10,0 % en 2023');
  });
  it('baisses consécutives', () => {
    expect(sp(constatSerie('Résultat net', pts([100, 90, 80])))).toBe('Résultat net : −11,1 % en 2023, deuxième baisse consécutive');
  });
  it('donnée manquante : repli neutre', () => {
    expect(constatSerie("Chiffre d'affaires", pts([null, 100]))).toBe("Chiffre d'affaires");
    expect(constatSerie("Chiffre d'affaires", [])).toBe("Chiffre d'affaires");
  });
  it('aucun mot de recommandation', () => {
    expect(constatSerie('Résultat net', pts([1, 2, 3, 4]))).not.toMatch(/achat|vente|acheter|vendre|opportunit|objectif/i);
  });
});

describe('constatCouverture', () => {
  it('hausse sur un an', () => {
    expect(sp(constatCouverture({ exercice: '2025', resultatNet: 413.59e9, resultatNetPrecedent: 393.5e9 })))
      .toBe('Résultat net de 413,59 Md FCFA en 2025, en hausse de 5,1 % sur un an.');
  });
  it('perte', () => {
    expect(sp(constatCouverture({ exercice: '2025', resultatNet: -2e9, resultatNetPrecedent: 1e9 }))).toBe('Perte nette de 2,00 Md FCFA en 2025.');
  });
  it('sans exercice précédent comparable', () => {
    expect(sp(constatCouverture({ exercice: '2025', resultatNet: 1e9, resultatNetPrecedent: -1e9 }))).toBe('Résultat net de 1,00 Md FCFA en 2025.');
  });
  it('sans donnée : null', () => expect(constatCouverture({ exercice: null, resultatNet: null, resultatNetPrecedent: null })).toBeNull());
});

describe('constatValorisation', () => {
  it('position par rapport à la médiane, sans jugement', () => {
    expect(constatValorisation(10.13, 12.4)).toBe('PER de 10,1 : en dessous de la médiane des comparables (12,4)');
    expect(constatValorisation(13, 12.4)).toBe('PER de 13,0 : proche de la médiane des comparables (12,4)');
    expect(constatValorisation(18, 12.4)).toBe('PER de 18,0 : au-dessus de la médiane des comparables (12,4)');
  });
  it('replis', () => {
    expect(constatValorisation(null, 12)).toBe('Valorisation');
    expect(constatValorisation(-3, 12)).toBe('Valorisation');
    expect(constatValorisation(10, null)).toBe('PER de 10,0');
  });
});

import { declarationEssentiel } from './constats';
describe('declarationEssentiel', () => {
  it('chiffre d’affaires et résultat, avec leurs variations', () => {
    expect(sp(declarationEssentiel({ societe: 'SONATEL', exercice: '2025', ca: 1923e9, caPrecedent: 1776e9, resultatNet: 413.59e9, resultatNetPrecedent: 393.5e9 })))
      .toBe('En 2025, SONATEL a réalisé 1 923 Md FCFA de chiffre d’affaires (+8,3 %) pour un résultat net de 413,59 Md FCFA (+5,1 %).');
  });
  it('perte : pas de variation en pourcentage', () => {
    expect(sp(declarationEssentiel({ societe: 'X', exercice: '2025', ca: 10e9, caPrecedent: null, resultatNet: -1e9, resultatNetPrecedent: 2e9 })))
      .toBe('En 2025, X a réalisé 10,00 Md FCFA de chiffre d’affaires pour une perte nette de 1,00 Md FCFA.');
  });
  it('sans chiffre d’affaires : repli sur le constat de couverture', () => {
    expect(declarationEssentiel({ societe: 'X', exercice: null, ca: null, caPrecedent: null, resultatNet: null, resultatNetPrecedent: null })).toBeNull();
  });
});
