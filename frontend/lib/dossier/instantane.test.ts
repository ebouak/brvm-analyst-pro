import { describe, expect, it } from 'vitest';
import { comparerEditions, lireMesures, mesuresDe, VERSION_MESURES } from './instantane';

const courant = mesuresDe({
  cours: 4350,
  per: 12.3,
  rendement: 0.04,
  publications: 205,
  piliers: [
    { cle: 'croissance', statut: 'tenu' },
    { cle: 'marge', statut: 'non_tenu' },
    { cle: 'valorisation', statut: 'tenu' },
  ],
});

const precedente = {
  edition: '2026-11-06',
  version: VERSION_MESURES,
  mesures: { version: 1, cours: 4000, per: 11, rendement: 0.045, publications: 203, piliers: { croissance: 'tenu', marge: 'tenu', valorisation: 'non_mesurable' } },
};

describe('mesuresDe', () => {
  it('range le statut de chaque pilier par clé, en version courante', () => {
    expect(courant.version).toBe(VERSION_MESURES);
    expect(courant.piliers).toEqual({ croissance: 'tenu', marge: 'non_tenu', valorisation: 'tenu' });
  });
});

describe('comparerEditions', () => {
  it('sans édition antérieure : null — jamais un « 0 % »', () => {
    expect(comparerEditions(courant, null)).toBeNull();
  });

  it('variation du cours, publications parues, piliers dont le constat a changé', () => {
    const c = comparerEditions(courant, precedente)!;
    expect(c.edition_precedente).toBe('2026-11-06');
    expect(c.variation_cours).toBeCloseTo(0.0875, 9);
    expect(c.publications_parues).toBe(2);
    expect(c.piliers_changes).toEqual([
      { cle: 'marge', avant: 'tenu', apres: 'non_tenu' },
      { cle: 'valorisation', avant: 'non_mesurable', apres: 'tenu' },
    ]);
  });

  it('versions différentes : aucune comparaison, encadré absent', () => {
    expect(comparerEditions(courant, { ...precedente, version: 2 })).toBeNull();
  });

  it('mesures illisibles : aucune comparaison', () => {
    expect(comparerEditions(courant, { ...precedente, mesures: null })).toBeNull();
    expect(comparerEditions(courant, { ...precedente, mesures: 'x' })).toBeNull();
  });

  it('cours absent d’un côté : variation null, le reste se compare', () => {
    const sansCours = { ...precedente, mesures: { ...precedente.mesures, cours: null } };
    const c = comparerEditions(courant, sansCours)!;
    expect(c.variation_cours).toBeNull();
    expect(c.publications_parues).toBe(2);
  });

  it('nombre de publications en baisse (suppressions) : pas de « parues » inventé', () => {
    const moins = { ...precedente, mesures: { ...precedente.mesures, publications: 210 } };
    expect(comparerEditions(courant, moins)!.publications_parues).toBeNull();
  });

  it('un pilier absent de l’édition précédente n’est pas compté comme changé', () => {
    const sans = { ...precedente, mesures: { ...precedente.mesures, piliers: { croissance: 'tenu' } } };
    expect(comparerEditions(courant, sans)!.piliers_changes).toEqual([]);
  });
});

describe('lireMesures', () => {
  it('écarte les champs de mauvais type', () => {
    const m = lireMesures({ cours: 'abc', per: NaN, rendement: 0.1, publications: 3, piliers: { a: 'tenu', b: 5 } }, 1)!;
    expect(m.cours).toBeNull();
    expect(m.per).toBeNull();
    expect(m.rendement).toBe(0.1);
    expect(m.piliers).toEqual({ a: 'tenu' });
  });
});
