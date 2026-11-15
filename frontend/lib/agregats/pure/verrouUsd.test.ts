import { describe, expect, it } from 'vitest';
import { planifierEcritures, ECRITURE_USD_AUTORISEE, type ObsLue } from './agregats/ecritures';

/**
 * L'application immédiate d'une relecture (lib/admin/rejouerSelection.ts)
 * passe par cette copie avec le drapeau par défaut : un montant USD (ETIT)
 * n'est pas écrit dans lignes_specifiques tant que l'affichage ne lit pas
 * l'unité (PR 2).
 */
const obs: ObsLue = {
  id: 'o1', code: 'ETIT', indicateur: 'pnb', periode: 'S1', date_arrete: '2026-06-30', perimetre: 'consolide',
  statut: 'publie', valeur: 1.2e9, comparateur: '=', texte_original: '1 200', motif: null, document_url: 'd1',
  document_libelle: 'S1 2026', page: 2, nature_source: 'emetteur', provisoire: false, controle: 'valide', unite: 'usd', unite_source: 'millions', decimales: 0,
};

describe('verrou USD côté relecture admin', () => {
  it('fermé : rien n’est écrit pour ETIT, l’agrégat est signalé', () => {
    expect(ECRITURE_USD_AUTORISEE).toBe(false);
    const p = planifierEcritures([obs], [{ table: 'income_statements', code: 'ETIT', periode: '2026-S1', type_periode: 'semestriel', lignes_specifiques: { pnb: 700e9 }, sources_specifiques: null }]);
    expect(p.misesAJour).toEqual([]);
    expect(p.ecartesUsd).toEqual(['ETIT|income_statements|2026-S1|pnb']);
  });
});
