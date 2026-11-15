import { describe, expect, it } from 'vitest';
import { AGREGATS, INDICATEURS_AGREGATS, defDe } from '../src/agregats/indicateurs.js';

describe('catalogue des agrégats bancaires', () => {
  it('chaque indicateur est unique', () => {
    expect(new Set(INDICATEURS_AGREGATS).size).toBe(INDICATEURS_AGREGATS.length);
  });

  it('reprend les clés existantes de lignes_specifiques lues par lib/bank/kpis.ts', () => {
    expect(defDe('produits_interets')).toMatchObject({ table: 'income_statements', cle: 'produit_interets' });
    expect(defDe('solvabilite_total')).toMatchObject({ table: 'balance_sheets', cle: 'ratio_solvabilite', nature: 'ratio' });
    expect(defDe('credits_clientele')).toMatchObject({ table: 'balance_sheets', cle: 'credits_clientele', nature: 'encours' });
  });

  it('le résultat net est lu pour le recoupement seulement : aucune clé écrite', () => {
    expect(defDe('resultat_net')).toMatchObject({ nature: 'flux', cle: null });
  });

  it('aucun ratio calculé n’est un indicateur extrait (le coefficient stocké sert de recoupement)', () => {
    for (const r of ['coefficient_exploitation', 'cout_du_risque_relatif', 'credits_sur_depots', 'roe']) {
      expect(INDICATEURS_AGREGATS).not.toContain(r);
    }
  });

  it('les flux vont au compte de résultat, les encours et ratios au bilan', () => {
    for (const a of AGREGATS) {
      expect(a.table).toBe(a.nature === 'flux' ? 'income_statements' : 'balance_sheets');
    }
  });
});
