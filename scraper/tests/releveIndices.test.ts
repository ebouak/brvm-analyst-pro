import { describe, it, expect } from 'vitest';
import { lignesReleveIndices } from '../src/persistence/repository.js';

describe('lignesReleveIndices', () => {
  it('relève chaque indice publié de la capture', () => {
    const lignes = lignesReleveIndices({
      date_marche: '2026-11-23',
      indices: [
        { code: 'BRVMC', libelle: 'BRVM Composite', valeur: 312.48, valeur_precedente: 311.02, variation_pct: 0.47 },
        { code: 'BRVM30', libelle: 'BRVM 30', valeur: 154.91, valeur_precedente: null, variation_pct: null },
      ],
    } as never);
    expect(lignes).toEqual([
      { code: 'BRVMC', date_marche: '2026-11-23', valeur: 312.48, variation_pct: 0.47 },
      { code: 'BRVM30', date_marche: '2026-11-23', valeur: 154.91, variation_pct: null },
    ]);
  });

  it("n'invente pas de point pour un indice sans valeur", () => {
    const lignes = lignesReleveIndices({
      date_marche: '2026-11-23',
      indices: [{ code: 'BRVMPRES', libelle: 'BRVM Prestige', valeur: null, valeur_precedente: null, variation_pct: null }],
    } as never);
    expect(lignes).toEqual([]);
  });
});
