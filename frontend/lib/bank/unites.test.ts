import { describe, expect, it } from 'vitest';
import { lignesAffichables, avecLignesAffichables } from './unites';

const src = (unite?: string) => ({ document_url: 'u', document_libelle: null, page: 1, perimetre: 'consolide', ...(unite ? { unite } : {}) });

describe('lignesAffichables : un tableau en FCFA ne reçoit jamais un montant USD', () => {
  it('retire les clés dont la source est en USD, garde FCFA et %', () => {
    expect(lignesAffichables(
      { pnb: 1.2e9, credits_clientele: 8000e9, ratio_solvabilite: 13.1, marge_interets: 400e9 },
      { pnb: src('usd'), credits_clientele: src('fcfa'), ratio_solvabilite: src('pct') },
    )).toEqual({ credits_clientele: 8000e9, ratio_solvabilite: 13.1, marge_interets: 400e9 });
  });
  it('le coefficient d’exploitation stocké n’est plus affiché (seul celui de lib/bank/lecture.ts)', () => {
    expect(lignesAffichables({ pnb: 300e9, coefficient_exploitation: 48.2 }, null)).toEqual({ pnb: 300e9 });
  });
  it('null reste null', () => {
    expect(lignesAffichables(null, null)).toBeNull();
  });
  it('appliqué à une ligne de comptes, le reste est intact', () => {
    const l = { periode: '2025', resultat_net: 1, lignes_specifiques: { pnb: 2, coefficient_exploitation: 3 }, sources_specifiques: { pnb: src('usd') } };
    expect(avecLignesAffichables(l)).toEqual({ ...l, lignes_specifiques: {} });
  });
});
