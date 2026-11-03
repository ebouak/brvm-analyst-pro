import { describe, it, expect } from 'vitest';
import { versLigneObligation, syntheseObligations, estEmetteurEtat } from './obligations';
import type { ObligationDaily } from '@/lib/types';

const MAINTENANT = new Date('2026-11-03T12:00:00Z');

const o = (p: Partial<ObligationDaily> & { code: string }): ObligationDaily => ({
  date_marche: '2026-11-02', designation: null, emetteur: null, taux_pct: null, maturite: null,
  cours_precedent: null, cours_jour: null, volume: null, valeur_echangee: null, ...p,
});

describe('versLigneObligation', () => {
  it('au pair, le YTM vaut le coupon', () => {
    const l = versLigneObligation(o({ code: 'TPCI.O1', taux_pct: 6, maturite: '2030-12-31', cours_jour: 10000 }), MAINTENANT);
    expect(l.ytm).not.toBeNull();
    expect(l.ytm!).toBeCloseTo(6, 1);
    expect(l.modifiedDuration).not.toBeNull();
    expect(l.isAmortissable).toBe(false);
  });

  it('sous 8 000 FCFA (amortissement partiel) : YTM masqué', () => {
    const l = versLigneObligation(o({ code: 'X', taux_pct: 6, maturite: '2030-12-31', cours_jour: 7999 }), MAINTENANT);
    expect(l.isAmortissable).toBe(true);
    expect(l.ytm).toBeNull();
  });

  it('lit coupon et échéance dans la désignation quand les colonnes sont vides', () => {
    const l = versLigneObligation(o({ code: 'EOS.O2', designation: 'BIDC-EBID 6,40% 2019-2029', cours_jour: 10000 }), MAINTENANT);
    expect(l.taux_pct).toBeCloseTo(6.4);
    expect(l.maturite).toBe('2029-12-31');
    expect(l.ytm!).toBeCloseTo(6.4, 1);
    expect(l.couponExonere).toBe(true);
  });

  it('échéance passée : pas d’années restantes, pas de YTM', () => {
    const l = versLigneObligation(o({ code: 'X', taux_pct: 6, maturite: '2025-12-31', cours_jour: 10000 }), MAINTENANT);
    expect(l.yearsToMaturity).toBeNull();
    expect(l.ytm).toBeNull();
  });

  it('YTM aberrant (≥ 25 %) écarté', () => {
    // 8 000 FCFA pour 10 000 remboursés dans ~2 mois : rendement annualisé démesuré.
    const l = versLigneObligation(o({ code: 'X', taux_pct: 1, maturite: '2026-12-31', cours_jour: 8000 }), MAINTENANT);
    expect(l.ytm).toBeNull();
    expect(l.modifiedDuration).toBeNull();
  });
});

describe('syntheseObligations', () => {
  it('moyenne des YTM calculables des seules obligations actives', () => {
    const lignes = [
      o({ code: 'A', taux_pct: 6, maturite: '2030-12-31', cours_jour: 10000 }),
      o({ code: 'B', taux_pct: 7, maturite: '2031-12-31', cours_jour: 10000 }),
      o({ code: 'C', taux_pct: 6, maturite: '2030-12-31', cours_jour: 5000 }), // active, sans YTM
      o({ code: 'D', taux_pct: 9, maturite: '2024-12-31', cours_jour: 10000 }), // échue
    ].map((x) => versLigneObligation(x, MAINTENANT));
    const s = syntheseObligations(lignes);
    expect(s.actives.map((r) => r.code)).toEqual(['A', 'B', 'C']);
    expect(s.echues.map((r) => r.code)).toEqual(['D']);
    expect(s.nbAvecYtm).toBe(2);
    expect(s.ytmMoyen!).toBeCloseTo(6.5, 1);
  });

  it('aucun YTM calculable → moyenne nulle, jamais zéro', () => {
    const s = syntheseObligations([versLigneObligation(o({ code: 'A', cours_jour: 10000 }), MAINTENANT)]);
    expect(s.ytmMoyen).toBeNull();
    expect(s.nbAvecYtm).toBe(0);
  });
});

describe('estEmetteurEtat', () => {
  it('reconnaît un Trésor public et écarte un émetteur privé', () => {
    expect(estEmetteurEtat('TPCI.O25', null, null)).toBe(true);
    expect(estEmetteurEtat('SNTS.O1', 'SONATEL 6,5% 2020-2027', 'SONATEL')).toBe(false);
  });
});
