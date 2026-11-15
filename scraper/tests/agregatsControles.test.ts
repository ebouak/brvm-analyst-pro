import { describe, expect, it } from 'vitest';
import { controler, TOLERANCE_COEFFICIENT, type Reference } from '../src/agregats/controles.js';
import type { ObservationNouvelle } from '../src/agregats/normaliser.js';

let n = 0;
const o = (p: Partial<ObservationNouvelle>): ObservationNouvelle => ({
  id: `o${++n}`, code: 'SGBC', indicateur: 'pnb', periode: 'S1', date_arrete: '2026-06-30', perimetre: 'individuel',
  statut: 'publie', valeur: 150e9, comparateur: '=', unite: 'fcfa', unite_source: 'millions', devise_source: 'FCFA',
  texte_original: '150 000', decimales: 0, motif: null, document_url: 'd1', document_libelle: 'S1 2026', document_date: null,
  publication_id: null, page: 1, libelle_exact: null, extrait: null, methode: 'gemini-agregats', modele: 'm',
  nature_source: 'emetteur', provisoire: false, controle: 'ok', controle_motif: null, ...p,
});
const ref = (p: Partial<Reference> = {}): Reference => ({
  totalBilanAnnuel: 5_000e9, resultatNetBase: null, totalActifsBase: null, fondsPropresBase: null, coefficientBase: null, valeursNm1: {}, ...p,
});
const etat = (obs: ObservationNouvelle[], indicateur: string) => obs.find((x) => x.indicateur === indicateur)!;

describe('1. unité plausible', () => {
  it('un PNB de semestre lu en milliers au lieu de millions (×1 000 trop petit) est à relire', () => {
    const r = controler([o({ valeur: 150e6 })], ref());
    expect(etat(r, 'pnb')).toMatchObject({ controle: 'a_relire' });
    expect(etat(r, 'pnb').controle_motif).toMatch(/unité/);
  });
  it('un PNB plausible passe', () => {
    expect(etat(controler([o({})], ref()), 'pnb').controle).toBe('ok');
  });
  it('des crédits supérieurs au total du bilan sont à relire', () => {
    const r = controler([o({ indicateur: 'credits_clientele', valeur: 6_000e9 })], ref());
    expect(etat(r, 'credits_clientele').controle).toBe('a_relire');
  });
  it('un ratio de solvabilité hors ]0 ; 100] est à relire', () => {
    const r = controler([o({ indicateur: 'solvabilite_total', valeur: 1439, unite: 'pct', unite_source: 'pct' })], ref());
    expect(etat(r, 'solvabilite_total').controle).toBe('a_relire');
  });
  it('sans total de bilan connu, un total lu hors [50 Md ; 50 000 Md] FCFA est à relire', () => {
    const r = controler([o({ indicateur: 'total_bilan', periode: 'S1', valeur: 5e9 })], ref({ totalBilanAnnuel: null }));
    expect(etat(r, 'total_bilan').controle).toBe('a_relire');
  });
});

describe('2. égalités comptables', () => {
  it('RBE = PNB − charges d’exploitation à l’arrondi près : passe', () => {
    const r = controler([o({ valeur: 150e9 }), o({ indicateur: 'charges_exploitation', valeur: 80e9 }), o({ indicateur: 'resultat_brut_exploitation', valeur: 70e9 })], ref());
    expect(r.every((x) => x.controle === 'ok')).toBe(true);
  });
  it('RBE incohérent : les trois valeurs sont à relire', () => {
    const r = controler([o({ valeur: 150e9 }), o({ indicateur: 'charges_exploitation', valeur: 80e9 }), o({ indicateur: 'resultat_brut_exploitation', valeur: 75e9 })], ref());
    expect(r.filter((x) => x.controle === 'a_relire')).toHaveLength(3);
    expect(etat(r, 'pnb').controle_motif).toMatch(/RBE/);
  });
  it('marge d’intérêts = produits − charges ; périmètres différents ne se comparent pas', () => {
    const ok = controler([
      o({ indicateur: 'produits_interets', valeur: 200e9 }), o({ indicateur: 'charges_interets', valeur: 90e9 }), o({ indicateur: 'marge_interets', valeur: 110e9 }),
    ], ref());
    expect(ok.every((x) => x.controle === 'ok')).toBe(true);
    const autres = controler([
      o({ indicateur: 'produits_interets', valeur: 200e9 }), o({ indicateur: 'charges_interets', valeur: 90e9 }), o({ indicateur: 'marge_interets', valeur: 150e9, perimetre: 'consolide' }),
    ], ref());
    expect(autres.every((x) => x.controle === 'ok')).toBe(true);
  });
});

describe('3. recoupements avec la base', () => {
  it('résultat net lu ≠ base au-delà de 0,5 % : à relire', () => {
    const r = controler([o({ indicateur: 'resultat_net', valeur: 40e9 })], ref({ resultatNetBase: 42e9 }));
    expect(etat(r, 'resultat_net').controle).toBe('a_relire');
  });
  it('résultat net concordant à l’arrondi publié : passe', () => {
    const r = controler([o({ indicateur: 'resultat_net', valeur: 42_000e6 })], ref({ resultatNetBase: 42_000_400_000 }));
    expect(etat(r, 'resultat_net').controle).toBe('ok');
  });
});

describe('3 bis. coefficient d’exploitation stocké, conservé en recoupement', () => {
  const pnbCharges = (charges: number) => [o({ valeur: 150e9 }), o({ indicateur: 'charges_exploitation', valeur: charges })];
  it('recalculé (charges ÷ PNB) concordant au stocké à la tolérance près : passe', () => {
    // 72/150 = 48,0 % ; stocké 48,6 % : écart 0,6 point ≤ 1.
    const r = controler(pnbCharges(72e9), ref({ coefficientBase: 48.6 }));
    expect(r.every((x) => x.controle === 'ok')).toBe(true);
  });
  it('écart au-delà de la tolérance : PNB et charges à relire, motif chiffré', () => {
    const r = controler(pnbCharges(72e9), ref({ coefficientBase: 52 }));
    expect(etat(r, 'pnb').controle).toBe('a_relire');
    expect(etat(r, 'charges_exploitation').controle).toBe('a_relire');
    expect(etat(r, 'pnb').controle_motif).toMatch(/coefficient d’exploitation recalculé 48,0 % ≠ stocké 52,0 %/);
    expect(TOLERANCE_COEFFICIENT).toBe(1);
  });
  it('sans coefficient stocké, ou sans charges publiées : aucun recoupement', () => {
    expect(controler(pnbCharges(72e9), ref()).every((x) => x.controle === 'ok')).toBe(true);
    expect(controler([o({})], ref({ coefficientBase: 10 }))[0]!.controle).toBe('ok');
  });
  it('les charges imprimées en négatif se comparent en valeur absolue', () => {
    expect(controler(pnbCharges(-72e9), ref({ coefficientBase: 48 })).every((x) => x.controle === 'ok')).toBe(true);
  });
});

describe('montants en USD (ETIT, décision du 2026-11-15)', () => {
  const usd = (p: Partial<ObservationNouvelle>) => o({ code: 'ETIT', unite: 'usd', devise_source: 'USD', ...p });
  it('jamais rapprochés des références de la base (en FCFA) : ni unité, ni recoupement', () => {
    const r = controler(
      [usd({ valeur: 1.1e9 }), usd({ indicateur: 'resultat_net', valeur: 0.2e9 }), usd({ indicateur: 'total_bilan', valeur: 27e9 })],
      ref({ totalBilanAnnuel: 16_000e9, resultatNetBase: 120e9, totalActifsBase: 16_000e9 }),
    );
    expect(r.every((x) => x.controle === 'ok')).toBe(true);
  });
  it('unité plausible contre le total du bilan du MÊME document en USD', () => {
    const r = controler([usd({ valeur: 1.1e6 }), usd({ indicateur: 'total_bilan', valeur: 27e9 })], ref({ totalBilanAnnuel: 16_000e9 }));
    expect(etat(r, 'pnb').controle).toBe('a_relire');
  });
  it('total du bilan en USD hors [0,1 ; 100] Md USD sans repère : à relire', () => {
    expect(controler([usd({ indicateur: 'total_bilan', valeur: 27e12 })], ref())[0]!.controle).toBe('a_relire');
  });
  it('une égalité ne rapproche jamais un montant USD d’un montant FCFA', () => {
    const r = controler([usd({ valeur: 150e9 }), o({ indicateur: 'charges_exploitation', valeur: 80e9 }), o({ indicateur: 'resultat_brut_exploitation', valeur: 75e9 })], ref());
    expect(etat(r, 'pnb').controle).toBe('ok');
  });
  it('variation N−1 seulement contre une valeur de la même unité', () => {
    expect(controler([usd({ valeur: 3e9 })], ref({ valeursNm1: { 'pnb|individuel|fcfa': 1e9 } }))[0]!.controle).toBe('ok');
    expect(controler([usd({ valeur: 3e9 })], ref({ valeursNm1: { 'pnb|individuel|usd': 1e9 } }))[0]!.controle).toBe('a_relire');
  });
});

describe('4. variation extrême', () => {
  it('PNB doublé d’un semestre à l’autre : relecture, pas rejet', () => {
    const r = controler([o({ valeur: 320e9 })], ref({ valeursNm1: { 'pnb|individuel|fcfa': 150e9 } }));
    expect(etat(r, 'pnb')).toMatchObject({ controle: 'a_relire', statut: 'publie', valeur: 320e9 });
  });
  it('variation ordinaire : passe', () => {
    expect(etat(controler([o({ valeur: 165e9 })], ref({ valeursNm1: { 'pnb|individuel|fcfa': 150e9 } })), 'pnb').controle).toBe('ok');
  });
  it('un N−1 d’un autre périmètre ne sert pas de référence', () => {
    expect(etat(controler([o({ valeur: 320e9 })], ref({ valeursNm1: { 'pnb|consolide|fcfa': 150e9 } })), 'pnb').controle).toBe('ok');
  });
});

it('une observation non publiée n’est jamais contrôlée', () => {
  const r = controler([o({ statut: 'non_trouve', valeur: null })], ref());
  expect(r[0]!.controle).toBe('ok');
});
