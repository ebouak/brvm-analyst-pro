import { describe, it, expect } from 'vitest';
import { SECTOR_LABELS } from '@/lib/financials/sectorLabels';
import { SECTOR_KEYS } from '@/lib/financials/sectors';

describe('SECTOR_LABELS', () => {
  it('chaque clé attendue par famille a un libellé non vide', () => {
    for (const fam of ['banque', 'assurance'] as const) {
      for (const key of SECTOR_KEYS[fam]) {
        expect(SECTOR_LABELS[fam][key], `${fam}.${key}`).toBeTruthy();
      }
    }
  });

  it('banque.pnb se libelle correctement', () => {
    expect(SECTOR_LABELS.banque.pnb).toBe('Produit Net Bancaire');
  });
});
