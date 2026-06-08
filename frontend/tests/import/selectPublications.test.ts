import { describe, it, expect } from 'vitest';
import { selectFinancialPublications, type PubRow } from '@/lib/import/selectPublications';

const rows: PubRow[] = [
  { id: '1', code: 'SLBC', libelle: 'Etats financiers - Exercice 2025 - SOLIBRA CI', date_publication: '2026-05-19', type_publication: 'etats_financiers', source_url: 'u2025' },
  { id: '2', code: 'SLBC', libelle: 'Etats financiers - Exercice 2023 - SOLIBRA CI', date_publication: '2024-05-10', type_publication: 'etats_financiers', source_url: 'u2023' },
  { id: '3', code: 'SLBC', libelle: 'Avis de convocation AGO', date_publication: '2026-04-01', type_publication: 'ag', source_url: 'uago' },
  { id: '4', code: 'SLBC', libelle: 'Etats financiers - Exercice 2024 - SOLIBRA CI', date_publication: '2025-05-12', type_publication: 'etats_financiers', source_url: 'u2024' },
];

describe('selectFinancialPublications', () => {
  it("garde l'exercice le plus récent + l'exercice 2023, ignore les non-états", () => {
    const sel = selectFinancialPublications(rows);
    const exercices = sel.map((p) => p.exercice).sort();
    expect(exercices).toEqual([2023, 2025]);
    expect(sel.find((p) => p.exercice === 2025)!.source_url).toBe('u2025');
  });

  it('renvoie vide si aucun état financier', () => {
    expect(selectFinancialPublications([rows[2]])).toEqual([]);
  });
});
