import { describe, expect, it } from 'vitest';
import { planifierEcritures, ECRITURE_USD_AUTORISEE, type ObsLue } from './agregats/ecritures';

/**
 * L'application immédiate d'une relecture (lib/admin/rejouerSelection.ts)
 * passe par cette copie avec le drapeau par défaut. Depuis la PR 2, toutes les
 * surfaces lisent l'unité (lib/bank/lecture.ts, lib/bank/unites.ts,
 * lib/bank/usd.test.ts) : un montant USD (ETIT) s'écrit, unité dans sa source.
 */
const obs: ObsLue = {
  id: 'o1', code: 'ETIT', indicateur: 'pnb', periode: 'S1', date_arrete: '2026-06-30', perimetre: 'consolide',
  statut: 'publie', valeur: 1.2e9, comparateur: '=', texte_original: '1 200', motif: null, document_url: 'd1',
  document_libelle: 'S1 2026', page: 2, nature_source: 'emetteur', provisoire: false, controle: 'valide', unite: 'usd', unite_source: 'millions', decimales: 0,
};

describe('verrou USD côté relecture admin', () => {
  it('ouvert : la valeur USD d’ETIT s’écrit, unité « usd » dans sa source', () => {
    expect(ECRITURE_USD_AUTORISEE).toBe(true);
    const p = planifierEcritures([obs], [{ table: 'income_statements', code: 'ETIT', periode: '2026-S1', type_periode: 'semestriel', lignes_specifiques: { pnb: 700e9 }, sources_specifiques: null }]);
    expect(p.misesAJour[0]!.lignes_specifiques).toEqual({ pnb: 1.2e9 });
    expect(p.misesAJour[0]!.sources_specifiques.pnb!.unite).toBe('usd');
    expect(p.ecartesUsd).toEqual([]);
  });
});
