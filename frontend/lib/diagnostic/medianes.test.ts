import { describe, it, expect } from 'vitest';
import { comparerAuxMedianes, mediane, type Pair } from './medianes';

const banque = (code: string, m: Record<string, unknown>): Pair =>
  ({ code, famille: 'banque', secteur: 'Services financiers', metriques: m });
const gen = (code: string, secteur: string, m: Record<string, unknown>): Pair =>
  ({ code, famille: 'general', secteur, metriques: m });

const ligne = (c: ReturnType<typeof comparerAuxMedianes>, libelle: string) =>
  c!.lignes.find((l) => l.libelle === libelle)!;

describe('mediane', () => {
  it('impair, pair, vide', () => {
    expect(mediane([3, 1, 2])).toBe(2);
    expect(mediane([4, 1, 3, 2])).toBe(2.5);
    expect(mediane([])).toBeNull();
  });
});

describe('comparerAuxMedianes', () => {
  const banques = [
    banque('SGBC', { roe: 0.2, per: 12, payoutRatio: 80, nplCoverage: 82 }),
    banque('B1', { roe: 0.1, per: 8, payoutRatio: 50, nplCoverage: 60 }),
    banque('B2', { roe: 0.12, per: 9, payoutRatio: 40, nplCoverage: 70 }),
    banque('B3', { roe: 0.14, per: 10, payoutRatio: 60, nplCoverage: 90 }),
  ];

  it('exclut la société de sa propre médiane et convertit les fractions en %', () => {
    const c = comparerAuxMedianes('SGBC', banques);
    expect(c!.groupe).toBe('banques cotées à la BRVM');
    expect(c!.nbSocietes).toBe(3);
    const roe = ligne(c, 'ROE');
    expect(roe.valeur).toBeCloseTo(20);
    expect(roe.mediane).toBeCloseTo(12);
    expect(roe.position).toBe('au-dessus');
    expect(roe.lecture).toBe('favorable');
  });

  it('ne reconvertit pas un ratio déjà en pourcents', () => {
    const c = comparerAuxMedianes('SGBC', banques);
    expect(ligne(c, 'Taux de distribution').valeur).toBe(80);
    expect(ligne(c, 'Taux de distribution').mediane).toBe(50);
    expect(ligne(c, 'Taux de distribution').lecture).toBe('neutre');
  });

  it('un PER plus élevé que la médiane est défavorable', () => {
    expect(ligne(comparerAuxMedianes('SGBC', banques), 'PER').lecture).toBe('defavorable');
  });

  it('écarte un PER négatif (société en perte) au lieu de le dire bon marché', () => {
    const u = [...banques, banque('PERTE', { per: -4, roe: -0.05 })];
    const c = comparerAuxMedianes('PERTE', u);
    expect(ligne(c, 'PER').valeur).toBeNull();
    expect(ligne(c, 'PER').position).toBeNull();
    // Le ROE négatif, lui, reste une information comparable.
    expect(ligne(c, 'ROE').lecture).toBe('defavorable');
  });

  it('sous trois pairs renseignés, pas de médiane', () => {
    const c = comparerAuxMedianes('SGBC', banques.slice(0, 3));
    expect(ligne(c, 'ROE').mediane).toBeNull();
    expect(ligne(c, 'ROE').nbPairs).toBe(2);
  });

  it('secteur assez grand : pairs du secteur ; sinon toute la famille', () => {
    const u = [
      gen('A', 'Industriels', { roe: 0.1 }),
      gen('B', 'Industriels', { roe: 0.2 }),
      gen('C', 'Industriels', { roe: 0.3 }),
      gen('D', 'Industriels', { roe: 0.4 }),
      gen('T', 'Télécommunications', { roe: 0.3 }),
      gen('U', 'Télécommunications', { roe: 0.5 }),
      banque('BQ', { roe: 0.9 }),
    ];
    const a = comparerAuxMedianes('A', u);
    expect(a!.groupe).toContain('Industriels');
    expect(ligne(a, 'ROE').mediane).toBeCloseTo(30);
    const t = comparerAuxMedianes('T', u);
    expect(t!.groupe).toBe('sociétés non financières cotées à la BRVM');
    // Pairs 10/20/30/40/50 → 30. Avec la banque (90), ce serait 35 : elle
    // n'entre jamais dans la médiane d'une société non financière.
    expect(ligne(t, 'ROE').mediane).toBeCloseTo(30);
  });

  it('« proche » dans une bande de 10 % autour de la médiane', () => {
    const u = [
      banque('X', { roe: 0.123 }),
      banque('B1', { roe: 0.1 }), banque('B2', { roe: 0.12 }), banque('B3', { roe: 0.14 }),
    ];
    expect(ligne(comparerAuxMedianes('X', u), 'ROE').position).toBe('proche');
  });

  it('code inconnu → null', () => {
    expect(comparerAuxMedianes('ZZZ', banques)).toBeNull();
  });
});
