import { describe, expect, it } from 'vitest';
import { echantillonHebdo, etendue, fmtNervosite, phraseRang, syntheseSerie, versLigne, type LigneNervosite } from './affichage';

const l = (date_marche: string, valeur: number | null, extra: Partial<LigneNervosite> = {}): LigneNervosite => ({
  date_marche, valeur, rapide: valeur, lente: valeur, rang: null, regime: null, n_titres: 40, ...extra,
});

describe('versLigne', () => {
  it('convertit les numeric PostgREST et garde les absents absents', () => {
    expect(versLigne({ date_marche: '2026-11-13', valeur: '12.3456', rapide: null, lente: '10', rang: '82.5', regime: 'agité', n_titres: 47 }))
      .toEqual({ date_marche: '2026-11-13', valeur: 12.3456, rapide: null, lente: 10, rang: 82.5, regime: 'agité', n_titres: 47 });
  });
  it('un régime sans rang, ou inconnu, tombe avec le rang', () => {
    expect(versLigne({ date_marche: '2026-11-13', valeur: 1, rang: null, regime: 'tendu', n_titres: 5 }).regime).toBeNull();
    const x = versLigne({ date_marche: '2026-11-13', valeur: 1, rang: 50, regime: 'panique', n_titres: 5 });
    expect(x.regime).toBeNull();
    expect(x.rang).toBeNull();
  });
});

describe('échantillon hebdomadaire', () => {
  it('garde la dernière séance de chaque semaine et la toute dernière séance', () => {
    const s = echantillonHebdo([
      l('2026-11-02', 10), l('2026-11-03', 11), l('2026-11-06', 12), // semaine du 2
      l('2026-11-09', null), l('2026-11-10', 13), // semaine du 9
      l('2026-11-16', 14),
    ]);
    expect(s.map((x) => x.date_marche)).toEqual(['2026-11-06', '2026-11-10', '2026-11-16']);
  });
});

describe('synthèse', () => {
  it('aucune valeur : null, jamais de zéro', () => {
    expect(syntheseSerie([l('2026-01-01', null)])).toBeNull();
    expect(syntheseSerie([])).toBeNull();
    expect(etendue([l('2026-01-01', null)])).toBeNull();
  });
  it('plus haut, plus bas, début et décompte des régimes lus dans les lignes', () => {
    const s = syntheseSerie([
      l('2007-05-01', null, { n_titres: 3 }),
      l('2008-01-02', 9, { rang: 10, regime: 'calme', n_titres: 6 }),
      l('2008-01-03', 25, { rang: 95, regime: 'tendu' }),
      l('2008-01-04', 12, { rang: 60, regime: 'normal' }),
    ])!;
    expect(s.debut).toBe('2008-01-02');
    expect(s.plusHaut).toEqual({ valeur: 25, date: '2008-01-03' });
    expect(s.plusBas).toEqual({ valeur: 9, date: '2008-01-02' });
    expect(s.minTitres).toBe(6);
    expect(s.parRegime).toEqual({ calme: 1, normal: 1, agité: 0, tendu: 1 });
  });
});

describe('formats', () => {
  it('pourcentage annualisé à une décimale, rang arrondi', () => {
    expect(fmtNervosite(12.345)).toMatch(/^12,3\s%$/);
    expect(phraseRang(82.4)).toBe('Au niveau ou au-dessus de 82 % des valeurs des cinq dernières années, ce jour compris.');
  });
});
