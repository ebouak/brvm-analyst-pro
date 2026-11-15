import { describe, expect, it } from 'vitest';
import { periodeDuDocument, periodeDeDate, dateArreteDe, moisDe } from '../src/agregats/periode.js';
import * as dates from '../src/agregats/dates.js';

describe('periodeDuDocument', () => {
  it.each([
    ['Rapport d\'activités - 1er semestre 2026 - SOCIETE GENERALE CI', 'rapport', { annee: 2026, code: 'S1', dateArrete: '2026-06-30' }],
    ['Etats financiers - 1er semestre 2026 - BOA BF', 'etats_financiers', { annee: 2026, code: 'S1', dateArrete: '2026-06-30' }],
    ['Rapport d\'activités - 3ème trimestre 2026 - SIB CI', 'rapport', { annee: 2026, code: 'T3', dateArrete: '2026-09-30' }],
    ['Etats financiers annuels 2025 - CORIS BANK INTERNATIONAL BF', 'etats_financiers', { annee: 2025, code: 'exercice', dateArrete: '2025-12-31' }],
    ['Rapport annuel 2024 - SGBCI', 'rapport', { annee: 2024, code: 'exercice', dateArrete: '2024-12-31' }],
    ['Bilan au 31 décembre 2025 - BICICI', 'bilan', { annee: 2025, code: 'exercice', dateArrete: '2025-12-31' }],
    ['Communiqué sur les résultats annuels 2025 - SIB', 'autre', { annee: 2025, code: 'exercice', dateArrete: '2025-12-31' }],
  ])('%s', (libelle, type, attendu) => {
    expect(periodeDuDocument(libelle, type)).toEqual(attendu);
  });

  it.each([
    ['Avis de convocation à l\'assemblée générale 2026', 'ag'],
    ['Bilan semestriel du contrat de liquidité - 1er semestre 2026', 'bilan'],
    ['Etats financiers 2024 et 2025 - XYZ', 'etats_financiers'], // deux années : ambigu
    ['Communiqué de notation 2026', 'notation'],
  ])('écarte « %s »', (libelle, type) => {
    expect(periodeDuDocument(libelle, type)).toBeNull();
  });
});

describe('dates d’arrêté', () => {
  it('date → période', () => {
    expect(periodeDeDate('2026-06-30')).toBe('S1');
    expect(periodeDeDate('2025-12-31')).toBe('exercice');
    expect(periodeDeDate('2026-03-31')).toBe('T1');
    expect(periodeDeDate('2026-09-30')).toBe('T3');
    expect(periodeDeDate('2026-05-31')).toBeNull();
  });
  it('période → date et mois', () => {
    expect(dateArreteDe(2026, 'S1')).toBe('2026-06-30');
    expect(moisDe('T3')).toBe(9);
    expect(moisDe('exercice')).toBe(12);
  });
  it('dates.ts est autonome (copié côté frontend) et réexporté par periode.ts', () => {
    expect(dates.dateArreteDe).toBe(dateArreteDe);
    expect(dates.periodeDeDate).toBe(periodeDeDate);
  });
});
