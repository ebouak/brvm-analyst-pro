import { describe, expect, it } from 'vitest';
import { trajectoireBancaire, encoursDossier, pnbParExercice } from './dossierBancaire';
import { periodesDepuisLignes, type LectureBancaire, type LigneAgregat, type LigneComptesBancaire } from './lecture';

const l = (cle: LigneAgregat['cle'], v: number, unite: 'fcfa' | 'pct' = 'fcfa'): LigneAgregat =>
  ({ cle, libelle: cle, unite, valeur: { valeur: v, perimetre: 'individuel', unite, source: null }, precedent: null, cloture: null });
const lecture = (enc: LigneAgregat[] = []) => ({ compteResultat: [], encours: enc } as unknown as LectureBancaire);

describe('trajectoireBancaire', () => {
  it('le PNB retenu remplace la colonne de revenu de l’exercice, le reste est gardé', () => {
    expect(trajectoireBancaire(
      [{ exercice: '2024', chiffre_affaires: 280e9, resultat_net: 80e9 }, { exercice: '2025', chiffre_affaires: 299e9, resultat_net: 95e9 }],
      [{ exercice: '2025', pnb: 300e9, unite: 'fcfa' }],
    )).toEqual([{ exercice: '2024', chiffre_affaires: 280e9, resultat_net: 80e9 }, { exercice: '2025', chiffre_affaires: 300e9, resultat_net: 95e9 }]);
  });
  it('un PNB publié en USD ne remplace jamais une barre en FCFA (graphique à une seule unité)', () => {
    const base = [{ exercice: '2025', chiffre_affaires: 690e9, resultat_net: 95e9 }];
    expect(trajectoireBancaire(base, [{ exercice: '2025', pnb: 1.2e9, unite: 'usd' }])).toEqual(base);
  });
});

describe('pnbParExercice', () => {
  it('exercices seulement, PNB sourcé seulement, avec son unité', () => {
    const src = (unite?: 'usd') => ({ document_url: 'u', document_libelle: null, page: 1, perimetre: 'individuel' as const, ...(unite ? { unite } : {}) });
    const lignes: LigneComptesBancaire[] = [
      { periode: '2025', lignes_specifiques: { pnb: 300e9 }, sources_specifiques: { pnb: src() } },
      { periode: '2024', lignes_specifiques: { pnb: 1.1e9 }, sources_specifiques: { pnb: src('usd') } },
      { periode: '2023', lignes_specifiques: { pnb: 250e9 }, sources_specifiques: null },
      { periode: '2026-S1', lignes_specifiques: { pnb: 160e9 }, sources_specifiques: { pnb: src() } },
    ];
    expect(pnbParExercice(periodesDepuisLignes(lignes, []))).toEqual([
      { exercice: '2025', pnb: 300e9, unite: 'fcfa' },
      { exercice: '2024', pnb: 1.1e9, unite: 'usd' },
      { exercice: '2023', pnb: null, unite: null },
    ]);
  });
});

describe('encoursDossier', () => {
  it('solvabilité d’abord, au plus N, le reste compté', () => {
    const r = encoursDossier(lecture([l('credits_clientele', 1), l('depots_clientele', 2), l('creances_souffrance_brutes', 3), l('fonds_propres', 4), l('solvabilite_total', 14, 'pct')]), 4);
    expect(r.affichees.map((x) => x.cle)).toEqual(['solvabilite_total', 'credits_clientele', 'depots_clientele', 'fonds_propres']);
    expect(r.omis).toBe(1);
  });
});
