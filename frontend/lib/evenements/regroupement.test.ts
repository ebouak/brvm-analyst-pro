import { describe, expect, it } from 'vitest';
import { periodeDuTitre, regrouperEvenements, type EvenementBrut } from './regroupement';
import { libelleEvenement, libelleSource } from './libelles';

describe('periodeDuTitre', () => {
  it.each([
    ["Rapport d'activités - 3e trimestre 2026 - SONATEL SN", 'T3-2026'],
    ["Rapport d'activités - 1er trimestre 2026 - BIIC BN", 'T1-2026'],
    ['Etats financiers - 1er semestre 2026 - ORANGE CI', 'S1-2026'],
    ['Bilan semestriel du contrat de liquidité - 2ème semestre 2025 - BIIC BN', 'S2-2025'],
    ['Etats financiers - Exercice 2025 - TRACTAFRIC MOTORS CI', 'A-2025'],
    ["Rapport d'activités annuel et Etats Financiers IFRS - Exercice 2025 - BIIC.", 'A-2025'],
    ['Notation Financière - SAFCA CI', null],
  ])('%s', (titre, attendu) => expect(periodeDuTitre(titre)).toBe(attendu));
});

const e = (id: string, date: string, title: string, type = 'resultats', code: string | null = 'BICB'): EvenementBrut =>
  ({ id, event_date: date, title, event_type: type, instrument_code: code, source_url: `https://x/${id}` });

describe('regrouperEvenements', () => {
  it('trois pièces d’une même publication : un seul événement, pièce principale = comptes', () => {
    const r = regrouperEvenements([
      e('c', '2026-06-20', 'Rapport des Commissaires Aux Comptes sur les Etats Financiers annuels - Exercice 2025 - BIIC'),
      e('b', '2026-06-19', "Rapport d'activités annuel - Exercice 2025 - BIIC"),
      e('a', '2026-06-19', 'Etats financiers IFRS - Exercice 2025 - BIIC'),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.id).toBe('a');
    expect(r[0]!.date).toBe('2026-06-19');
    expect(r[0]!.pieces.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
  it('périodes, sociétés ou familles différentes : jamais fusionnées', () => {
    const r = regrouperEvenements([
      e('1', '2026-10-30', "Rapport d'activités - 3e trimestre 2026 - SONATEL", 'resultats', 'SNTS'),
      e('2', '2026-07-30', "Rapport d'activités - 2e trimestre 2026 - SONATEL", 'resultats', 'SNTS'),
      e('3', '2026-10-30', "Rapport d'activités - 3e trimestre 2026 - ORANGE CI", 'resultats', 'ORAC'),
      e('4', '2026-10-30', 'Convocation AGO - 3e trimestre 2026 - SONATEL', 'assemblee', 'SNTS'),
    ]);
    expect(r).toHaveLength(4);
    expect(r.map((x) => x.date)).toEqual(['2026-10-30', '2026-10-30', '2026-10-30', '2026-07-30']);
  });
  it('sans période ou sans société : laissé seul', () => {
    const r = regrouperEvenements([
      e('1', '2026-03-03', 'Notation Financière - SAFCA CI', 'notation', 'SAFC'),
      e('2', '2026-03-03', 'Notation Financière - SAFCA CI', 'notation', 'SAFC'),
      e('3', '2026-03-03', 'Etats financiers - Exercice 2025', 'resultats', null),
    ]);
    expect(r).toHaveLength(3);
  });
});

describe('libellés', () => {
  it('types et sources en français', () => {
    expect(libelleEvenement('resultats')).toBe('Résultats');
    expect(libelleEvenement('liquidite')).toBe('Contrat de liquidité');
    expect(libelleSource('info_permanente')).toBe('Information permanente');
    expect(libelleSource('communique')).toBe('Communiqué');
  });
});
