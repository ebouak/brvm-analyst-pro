import { describe, it, expect } from 'vitest';
import { encoderEvenement, lireEvenements, decouperTexte } from './flux';
import { fusionnerSources, formaterSource, plusRecente } from './sources';
import type { EvenementFlux } from './types';

describe('flux SSE', () => {
  it('aller-retour, y compris coupé au milieu', () => {
    const e1: EvenementFlux = { type: 'etape', libelle: 'Recherche des données…' };
    const e2: EvenementFlux = { type: 'meta', meta: { provenance: 'jev', sources: [{ libelle: 'Cotations', date: '2026-11-06' }], relances: ['a'] } };
    const brut = encoderEvenement(e1) + encoderEvenement(e2);
    const coupe = 30;
    const a = lireEvenements(brut.slice(0, coupe));
    const b = lireEvenements(a.reste + brut.slice(coupe));
    expect([...a.evenements, ...b.evenements]).toEqual([e1, e2]);
    expect(b.reste).toBe('');
  });
  it('ignore un bloc illisible ou d’une forme inconnue', () => {
    const r = lireEvenements('data: {pas du json\n\ndata: {"type":"autre"}\n\ndata: {"type":"meta","meta":{"provenance":"humain","sources":[],"relances":[]}}\n\n');
    expect(r.evenements).toEqual([]);
  });
  it('découpage : rien de perdu', () => {
    const t = 'Le cours de STAC a clôturé à 1 234 FCFA,\nen hausse de 1,2 % sur la séance.';
    expect(decouperTexte(t, 3).join('')).toBe(t);
    expect(decouperTexte(t, 3).length).toBeGreaterThan(2);
  });
});

describe('sources', () => {
  it('fusion par libellé, date la plus récente', () => {
    expect(
      fusionnerSources([
        { libelle: 'Cotations', date: '2026-11-01' },
        { libelle: 'Dividendes', date: null },
        { libelle: 'Cotations', date: '2026-11-06' },
      ]),
    ).toEqual([
      { libelle: 'Cotations', date: '2026-11-06' },
      { libelle: 'Dividendes', date: null },
    ]);
  });
  it('plafond : une date future n’est pas retenue', () => {
    expect(plusRecente(['2026-11-01', '2027-03-01', null], '2026-11-08')).toBe('2026-11-01');
  });
  it('formatage', () => {
    expect(formaterSource({ libelle: 'Cotations BRVM', date: '2026-11-06' })).toBe('Cotations BRVM · données au 6 nov. 2026');
    expect(formaterSource({ libelle: 'Notation financière', date: null })).toBe('Notation financière · date non précisée');
  });
});
