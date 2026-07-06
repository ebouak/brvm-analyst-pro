import { describe, it, expect } from 'vitest';
import { matchNewsSignals, type NewsRow } from './newsSignals';

function row(overrides: Partial<NewsRow>): NewsRow {
  return {
    titre: '',
    resume: null,
    source_label: null,
    source: 'brvm',
    date_publication: '2026-01-15',
    source_url: 'https://brvm.org/exemple',
    ...overrides,
  };
}

describe('matchNewsSignals', () => {
  it('détecte un litige via mot-clé dans le titre', () => {
    const rows = [row({ titre: 'Litige commercial en cours contre la société' })];
    const result = matchNewsSignals(rows);
    expect(result.litiges).toHaveLength(1);
    expect(result.litiges[0].titre).toBe('Litige commercial en cours contre la société');
  });

  it('détecte un signal insider via mot-clé dans le résumé', () => {
    const rows = [row({ titre: 'Communiqué', resume: 'Démission du directeur général annoncée ce jour' })];
    const result = matchNewsSignals(rows);
    expect(result.insiders).toHaveLength(1);
  });

  it('détecte la concentration client via mot-clé', () => {
    const rows = [row({ titre: 'Perte d\'un client principal impactant le chiffre d\'affaires' })];
    const result = matchNewsSignals(rows);
    expect(result.concentration_client).toHaveLength(1);
  });

  it('ignore un article sans mot-clé pertinent (faux positif évité)', () => {
    const rows = [row({ titre: 'Publication des résultats annuels 2025' })];
    const result = matchNewsSignals(rows);
    expect(result.litiges).toHaveLength(0);
    expect(result.insiders).toHaveLength(0);
    expect(result.concentration_client).toHaveLength(0);
  });

  it('ignore "poursuite" au sens de continuation (pas de litige)', () => {
    const rows = [row({ titre: 'Poursuite de la croissance du chiffre d\'affaires au 2e trimestre' })];
    const result = matchNewsSignals(rows);
    expect(result.litiges).toHaveLength(0);
  });

  it('un même article peut alimenter plusieurs catégories', () => {
    const rows = [row({ titre: 'Démission du PDG suite à un contentieux judiciaire' })];
    const result = matchNewsSignals(rows);
    expect(result.insiders).toHaveLength(1);
    expect(result.litiges).toHaveLength(1);
  });

  it('renvoie des listes vides pour une entrée vide', () => {
    const result = matchNewsSignals([]);
    expect(result).toEqual({ litiges: [], insiders: [], concentration_client: [] });
  });

  it('utilise source_label si présent, sinon source', () => {
    const rows = [row({ titre: 'Sanction prononcée par le régulateur', source_label: 'BRVM officiel' })];
    const result = matchNewsSignals(rows);
    expect(result.litiges[0].source).toBe('BRVM officiel');
  });
});
