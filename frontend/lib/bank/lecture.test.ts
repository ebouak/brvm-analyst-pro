import { describe, expect, it } from 'vitest';
import { periodesDepuisLignes, lireBanque, lirePeriode, dernierExercice, deviseDe, montantCourt, type LigneComptesBancaire } from './lecture';

const sp = (s: string) => s.replace(/[  ]/g, ' ');
const src = (perimetre: 'individuel' | 'consolide' | 'non_precise' = 'individuel', doc = 'https://x/s1.pdf') =>
  ({ document_url: doc, document_libelle: 'Rapport S1', page: 3, perimetre });

/** Construit une ligne dont chaque clé est sourcée. */
const ligne = (periode: string, valeurs: Record<string, number>, extra: Partial<LigneComptesBancaire> = {}, perimetre: 'individuel' | 'consolide' = 'individuel'): LigneComptesBancaire => ({
  periode,
  lignes_specifiques: valeurs,
  sources_specifiques: Object.fromEntries(Object.keys(valeurs).map((k) => [k, src(perimetre)])),
  ...extra,
});

const income = [
  ligne('2026-S1', { pnb: 160e9, charges_exploitation: 72e9, cout_du_risque: 8e9 }, { resultat_net: 50e9 }),
  ligne('2025-S1', { pnb: 145e9, charges_exploitation: 70e9, cout_du_risque: 10e9 }, { resultat_net: 45e9 }),
  ligne('2025', {}, { resultat_net: 95e9 }),
];
const balance = [
  ligne('2026-S1', { credits_clientele: 3000e9, depots_clientele: 3800e9, fonds_propres: 600e9 }),
  ligne('2025-S1', { credits_clientele: 2800e9, depots_clientele: 3500e9 }),
  ligne('2025', { credits_clientele: 2900e9 }),
];
const periodes = periodesDepuisLignes(income, balance);
const s1 = lireBanque(periodes, { annee: 2026, code: 'S1' })!;

describe('lirePeriode', () => {
  it('formats de période en base', () => {
    expect(lirePeriode('2026-S1')).toEqual({ annee: 2026, code: 'S1' });
    expect(lirePeriode('2025')).toEqual({ annee: 2025, code: 'exercice' });
    expect(lirePeriode('2025-12-31')).toEqual({ annee: 2025, code: 'exercice' });
    expect(lirePeriode('2026-S2')).toBeNull();
  });
});

describe('periodesDepuisLignes', () => {
  it('ne retient qu’une valeur sourcée ; le résultat net vient de la base, sans source', () => {
    const p = periodesDepuisLignes([{ periode: '2026-S1', lignes_specifiques: { pnb: 1e9 }, sources_specifiques: null, resultat_net: 2e8 }], []);
    expect(p[0]!.valeurs.pnb).toBeUndefined();
    expect(p[0]!.valeurs.resultat_net).toEqual({ valeur: 2e8, perimetre: 'non_precise', unite: 'fcfa', source: null });
  });
  it('fonds propres de base seulement à défaut d’un agrégat sourcé', () => {
    const p = periodesDepuisLignes([], [{ periode: '2025', lignes_specifiques: null, sources_specifiques: null, total_capitaux_propres: 5e11 }]);
    expect(p[0]!.valeurs.fonds_propres).toEqual({ valeur: 5e11, perimetre: 'non_precise', unite: 'fcfa', source: null });
  });
  it('trie du plus récent au plus ancien, intermédiaires compris', () => {
    expect(periodes.map((p) => `${p.annee}-${p.code}`)).toEqual(['2026-S1', '2025-exercice', '2025-S1']);
  });
});

describe('lireBanque — 1er semestre 2026', () => {
  it('période et vocabulaire', () => {
    expect(s1).toMatchObject({ annee: 2026, code: 'S1', libelle: '1er semestre 2026', libellePrecedent: '1er semestre 2025', extrait: true });
  });

  it('compte de résultat dans l’ordre PNB → résultat net, comparé au même semestre N−1', () => {
    expect(s1.compteResultat.map((l) => l.cle)).toEqual(['pnb', 'charges_exploitation', 'cout_du_risque', 'resultat_net']);
    const pnb = s1.compteResultat[0]!;
    expect(pnb.precedent).toMatchObject({ valeur: 145e9, libelle: '1er semestre 2025', uniteVariation: '%' });
    expect(pnb.precedent!.variation).toBeCloseTo(10.345, 2);
    expect(pnb.valeur.source).toEqual({ document_url: 'https://x/s1.pdf', document_libelle: 'Rapport S1', page: 3 });
  });

  it('encours comparés à la même date N−1, puis à la dernière clôture annuelle', () => {
    const credits = s1.encours.find((l) => l.cle === 'credits_clientele')!;
    expect(credits.precedent).toMatchObject({ valeur: 2800e9, libelle: '1er semestre 2025' });
    expect(credits.cloture).toMatchObject({ valeur: 2900e9, libelle: 'exercice 2025' });
  });

  it('ratios calculés une seule fois, avec phrase descriptive', () => {
    const r = Object.fromEntries(s1.ratios.map((x) => [x.cle, x]));
    expect(r.coefficient_exploitation!.valeur).toBeCloseTo(0.45, 6);
    expect(r.coefficient_exploitation!.precedent).toBeCloseTo(70 / 145, 6);
    expect(sp(r.coefficient_exploitation!.phrase)).toBe('Les charges d’exploitation représentent 45,0 % du PNB.');
    expect(r.cout_du_risque_relatif!.valeur).toBeCloseTo((8 / 3000) * 2, 8);
    expect(r.cout_du_risque_relatif!.mention).toBe('semestre annualisé (×2)');
    expect(r.credits_sur_depots!.valeur).toBeCloseTo(3000 / 3800, 6);
    expect(r.roe!.valeur).toBeCloseTo(100 / 600, 6);
    expect(r.roe!.mention).toBe('douze mois glissants : exercice 2025 + 1er semestre 2026 − 1er semestre 2025');
  });

  it('agrégats non publiés : nommés, jamais à zéro', () => {
    expect(s1.nonPublies).toEqual(['Marge d’intérêts', 'Commissions nettes', 'Créances en souffrance brutes', 'Solvabilité totale']);
    expect(s1.mentionNonPublies).toBe('Autres agrégats non publiés pour ce semestre : marge d’intérêts, commissions nettes, créances en souffrance brutes, solvabilité totale.');
  });

  it('constat de titre : PNB, puis le constat le plus marquant (règle déterministe)', () => {
    expect(sp(s1.titre)).toBe('PNB en hausse de 10,3 % sur le 1er semestre 2026, coefficient d’exploitation en baisse de 3,3 points, à 45,0 %');
    expect(s1.constat.second?.cle).toBe('coefficient_exploitation');
  });

  it('sources uniques', () => {
    expect(s1.sources).toEqual([{ document_url: 'https://x/s1.pdf', document_libelle: 'Rapport S1', page: 3 }]);
  });
});

describe('règles de prudence', () => {
  it('ROE non affiché sans les trois termes du glissement (pas d’annualisation naïve)', () => {
    const p = periodesDepuisLignes(income.filter((l) => l.periode !== '2025'), balance);
    expect(lireBanque(p, { annee: 2026, code: 'S1' })!.ratios.find((r) => r.cle === 'roe')).toBeUndefined();
  });

  it('périmètres différents : aucun ratio ni comparaison', () => {
    const p = periodesDepuisLignes(
      [ligne('2026-S1', { pnb: 160e9 }), ligne('2026-S1', { charges_exploitation: 72e9 }, {}, 'consolide'), ligne('2025-S1', { pnb: 145e9 }, {}, 'consolide')],
      [],
    );
    const l = lireBanque(p, { annee: 2026, code: 'S1' })!;
    expect(l.ratios.find((r) => r.cle === 'coefficient_exploitation')).toBeUndefined();
    expect(l.compteResultat.find((x) => x.cle === 'pnb')!.precedent).toBeNull();
  });

  it('aucune valeur sourcée → extrait = false (ancien affichage)', () => {
    const p = periodesDepuisLignes([{ periode: '2026-S1', lignes_specifiques: { pnb: 1e9 }, sources_specifiques: null, resultat_net: 1e8 }], []);
    expect(lireBanque(p, { annee: 2026, code: 'S1' })!.extrait).toBe(false);
  });

  it('exercice : ROE sur l’exercice, aucun coût du risque annualisé, mention « pour cet exercice »', () => {
    const p = periodesDepuisLignes(
      [ligne('2025', { pnb: 300e9, cout_du_risque: 20e9 }, { resultat_net: 95e9 })],
      [ligne('2025', { credits_clientele: 2900e9, fonds_propres: 600e9 })],
    );
    const l = lireBanque(p, { annee: 2025, code: 'exercice' })!;
    const r = Object.fromEntries(l.ratios.map((x) => [x.cle, x]));
    expect(r.roe!.valeur).toBeCloseTo(95 / 600, 6);
    expect(r.roe!.mention).toBeNull();
    expect(r.cout_du_risque_relatif!.mention).toBeNull();
    expect(l.mentionNonPublies).toMatch(/^Autres agrégats non publiés pour cet exercice/);
  });

  it('sans PNB ni comparaison : titre neutre', () => {
    const p = periodesDepuisLignes([], [ligne('2026-S1', { credits_clientele: 3000e9 })]);
    expect(lireBanque(p, { annee: 2026, code: 'S1' })!.titre).toBe('Comptes du 1er semestre 2026');
  });

  it('période absente → null', () => {
    expect(lireBanque(periodes, { annee: 2024, code: 'S1' })).toBeNull();
  });

  it('dernierExercice : le plus récent qui porte une valeur sourcée', () => {
    expect(dernierExercice(periodes)).toEqual({ annee: 2025, code: 'exercice' });
  });
});

describe('unités : ETIT publie en USD (avenant du 2026-11-15)', () => {
  const usd = (periode: string, valeurs: Record<string, number>, extra: Partial<LigneComptesBancaire> = {}): LigneComptesBancaire => ({
    periode,
    lignes_specifiques: valeurs,
    sources_specifiques: Object.fromEntries(Object.keys(valeurs).map((k) => [k, { ...src('consolide'), unite: k === 'ratio_solvabilite' ? 'pct' : 'usd' }])),
    ...extra,
  });
  const p = periodesDepuisLignes(
    [usd('2026-S1', { pnb: 1.2e9, charges_exploitation: 0.84e9 }, { resultat_net: 70e9 }), usd('2025-S1', { pnb: 1.1e9, charges_exploitation: 0.8e9 }, { resultat_net: 60e9 }), { periode: '2025', lignes_specifiques: { pnb: 690e9 }, sources_specifiques: null, resultat_net: 95e9 }],
    [usd('2026-S1', { credits_clientele: 15e9, depots_clientele: 20e9, fonds_propres: 2.5e9, ratio_solvabilite: 13.1 })],
  );
  const l = lireBanque(p, { annee: 2026, code: 'S1' })!;

  it('l’unité de la source est portée par la valeur et la ligne ; la base est en FCFA', () => {
    const pnb = l.compteResultat.find((x) => x.cle === 'pnb')!;
    expect(pnb.unite).toBe('usd');
    expect(pnb.valeur.unite).toBe('usd');
    expect(l.compteResultat.find((x) => x.cle === 'resultat_net')!.unite).toBe('fcfa');
    expect(l.encours.find((x) => x.cle === 'solvabilite_total')!.unite).toBe('pct');
  });
  it('ratios USD ÷ USD calculés sans conversion', () => {
    const r = Object.fromEntries(l.ratios.map((x) => [x.cle, x]));
    expect(r.coefficient_exploitation!.valeur).toBeCloseTo(0.7, 6);
    expect(r.credits_sur_depots!.valeur).toBeCloseTo(0.75, 6);
  });
  it('jamais de ratio ni de comparaison entre USD et FCFA', () => {
    // ROE : résultat net de la base (FCFA) ÷ fonds propres publiés en USD → non calculé.
    expect(l.ratios.find((x) => x.cle === 'roe')).toBeUndefined();
    // Un exercice en FCFA ne sert pas de « dernière clôture » à un encours en USD.
    const p2 = periodesDepuisLignes([], [usd('2026-S1', { credits_clientele: 15e9 }), { periode: '2025', lignes_specifiques: { credits_clientele: 8000e9 }, sources_specifiques: { credits_clientele: { ...src('consolide'), unite: 'fcfa' } } as never }]);
    expect(lireBanque(p2, { annee: 2026, code: 'S1' })!.encours[0]!.cloture).toBeNull();
  });
  it('le titre écrit la devise de la source', () => {
    const p3 = periodesDepuisLignes([usd('2026-S1', { pnb: 1.2e9 })], []);
    expect(sp(lireBanque(p3, { annee: 2026, code: 'S1' })!.titre)).toBe('PNB de 1,2 Md USD sur le 1er semestre 2026');
  });
  it('formateurs', () => {
    expect(deviseDe('usd')).toBe('USD');
    expect(deviseDe('fcfa')).toBe('FCFA');
    expect(sp(montantCourt(1.2e9, 'usd'))).toBe('1,2 Md USD');
    expect(sp(montantCourt(3000e9, 'fcfa'))).toBe('3 000 Md FCFA');
    expect(sp(montantCourt(14.39, 'pct'))).toBe('14,39 %');
  });
});
