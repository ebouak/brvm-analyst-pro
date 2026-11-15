import { describe, expect, it } from 'vitest';
import { rapprocherMontants } from '../src/prudentiel/montants.js';

describe('rapprocherMontants', () => {
  it('une seule valeur : unique', () => {
    expect(rapprocherMontants([{ id: 'a', valeur: 1e9, unite_source: 'millions', decimales: 0 }])).toEqual({ classe: 'unique', retenue: 'a', conflits: [] });
  });
  it('152 345 millions et 152 345 210 milliers concordent : la plus fine est retenue', () => {
    const r = rapprocherMontants([
      { id: 'a', valeur: 152_345e6, unite_source: 'millions', decimales: 0 },
      { id: 'b', valeur: 152_345_210e3, unite_source: 'milliers', decimales: 0 },
    ]);
    expect(r).toEqual({ classe: 'rounding_compatible', retenue: 'b', conflits: [] });
  });
  it('deux montants au même arrondi qui diffèrent : conflit', () => {
    const r = rapprocherMontants([
      { id: 'a', valeur: 152_345e6, unite_source: 'millions', decimales: 0 },
      { id: 'b', valeur: 152_399e6, unite_source: 'millions', decimales: 0 },
    ]);
    expect(r.classe).toBe('source_conflict');
    expect(r.conflits).toEqual([['a', 'b']]);
  });
  it('un montant grossier ne réconcilie pas deux montants précis contradictoires', () => {
    const r = rapprocherMontants([
      { id: 'a', valeur: 152_345_100e3, unite_source: 'milliers', decimales: 0 },
      { id: 'b', valeur: 152_345_900e3, unite_source: 'milliers', decimales: 0 },
      { id: 'c', valeur: 152e9, unite_source: 'milliards', decimales: 0 },
    ]);
    expect(r.classe).toBe('source_conflict');
  });
  it('un montant en USD et un montant en FCFA ne se rapprochent jamais (aucune conversion)', () => {
    const r = rapprocherMontants([
      { id: 'a', valeur: 1e9, unite: 'usd', unite_source: 'millions', decimales: 0 },
      { id: 'b', valeur: 1e9, unite: 'fcfa', unite_source: 'millions', decimales: 0 },
    ]);
    expect(r).toEqual({ classe: 'source_conflict', retenue: null, conflits: [['a', 'b']] });
  });
});
