import { describe, expect, it } from 'vitest';
import { planAction, uniteCorrection, libelleValeur, LIBELLES_AGREGATS } from './relecture';
import { AGREGATS } from '@/lib/agregats/pure/agregats/indicateurs';

const item = { id: 'r1', code: 'SGBC', indicateur: 'pnb', observations: ['a', 'b'] };

describe('planAction', () => {
  it('valider une observation : elle passe « valide », les autres « rejete »', () => {
    expect(planAction(item, { action: 'valider', observation: 'b' })).toEqual({
      valides: ['b'], rejetees: ['a'], correction: null, statut: 'validee', valeurCorrigee: null,
    });
  });
  it('valider une observation étrangère à l’élément : refusé', () => {
    expect(() => planAction(item, { action: 'valider', observation: 'z' })).toThrow(/n’appartient pas/);
  });
  it('corriger : la valeur saisie remplace la lecture de l’observation choisie', () => {
    expect(planAction(item, { action: 'corriger', observation: 'a', texte: '152 345 210 000' })).toEqual({
      valides: ['a'], rejetees: ['b'], correction: { observation: 'a', valeur: 152345210000, texte: '152 345 210 000', decimales: 0 }, statut: 'corrigee', valeurCorrigee: 152345210000,
    });
  });
  it('corriger avec un nombre illisible : refusé', () => {
    expect(() => planAction(item, { action: 'corriger', observation: 'a', texte: 'abc' })).toThrow(/illisible/);
  });
  it('rejeter : toutes les observations sont écartées', () => {
    expect(planAction(item, { action: 'rejeter' })).toEqual({ valides: [], rejetees: ['a', 'b'], correction: null, statut: 'rejetee', valeurCorrigee: null });
  });
});

describe('unités', () => {
  it('une correction garde la devise publiée (USD pour ETIT), jamais convertie', () => {
    expect(uniteCorrection('pnb', 'USD')).toBe('usd');
    expect(uniteCorrection('pnb', 'FCFA')).toBe('fcfa');
    expect(uniteCorrection('pnb', null)).toBe('fcfa');
    expect(uniteCorrection('solvabilite_total', 'USD')).toBe('pct');
  });
  it('libellé d’une valeur selon son unité', () => {
    expect(libelleValeur(1_234_500_000, 'usd')).toMatch(/USD$/);
    expect(libelleValeur(150e9, 'fcfa')).toMatch(/FCFA$/);
    expect(libelleValeur(14.39, 'pct')).toMatch(/%$/);
    expect(libelleValeur(null, 'fcfa')).toBe('non exploitable');
  });
});

it('un libellé pour chaque indicateur du catalogue (copie du scraper)', () => {
  expect(LIBELLES_AGREGATS.pnb).toBe('Produit net bancaire');
  expect(Object.keys(LIBELLES_AGREGATS).sort()).toEqual(AGREGATS.map((a) => a.indicateur).sort());
});
