import { describe, expect, it } from 'vitest';
import { SECTEURS_2026, secteursCourants } from '@/lib/secteurs/nomenclature';

describe('secteurs favoris — nomenclature BRVM 2026', () => {
  it('convertit les anciens libellés du profil', () => {
    expect(secteursCourants(['Finance', 'Agro-industrie', 'Distribution', 'Industrie'])).toEqual([
      'Services financiers', 'Consommation de base', 'Consommation discrétionnaire', 'Industriels',
    ]);
  });
  it('fusionne les doublons nés de la conversion (Industrie et Transport → Industriels)', () => {
    expect(secteursCourants(['Industrie', 'Transport', 'Industriels'])).toEqual(['Industriels']);
  });
  it('garde les libellés 2026 et écarte l’inconnu', () => {
    expect(secteursCourants(['Énergie', 'Energie', 'Télécommunications', 'Agriculture', ''])).toEqual(['Énergie', 'Télécommunications']);
  });
  it('vide ou nul → vide', () => {
    expect(secteursCourants(null)).toEqual([]);
    expect(secteursCourants(undefined)).toEqual([]);
  });
  it('sept secteurs, identiques aux libellés des indices sectoriels', () => {
    expect(SECTEURS_2026).toHaveLength(7);
  });
});
