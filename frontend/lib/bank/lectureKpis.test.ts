import { describe, expect, it } from 'vitest';
import { appliquerLecture } from './lectureKpis';
import type { BankKpis } from './kpis';
import type { LectureBancaire } from './lecture';

const kpis = { costIncome: 0.6, transformation: 0.9, ratioSolvabilite: null } as unknown as BankKpis;
const lecture = (ratios: LectureBancaire['ratios'], encours: LectureBancaire['encours'] = []) =>
  ({ extrait: true, ratios, encours } as unknown as LectureBancaire);

describe('appliquerLecture', () => {
  it('le coefficient et la transformation de la carte deviennent ceux de la lecture', () => {
    const k = appliquerLecture(kpis, lecture([
      { cle: 'coefficient_exploitation', libelle: '', valeur: 0.45, precedent: null, phrase: '', mention: null },
      { cle: 'credits_sur_depots', libelle: '', valeur: 0.79, precedent: null, phrase: '', mention: null },
    ]));
    expect(k.costIncome).toBe(0.45);
    expect(k.transformation).toBe(0.79);
  });
  it('la solvabilité retenue (en %) devient une fraction', () => {
    const k = appliquerLecture(kpis, lecture([], [{ cle: 'solvabilite_total', libelle: '', unite: 'pct', valeur: { valeur: 14.39, perimetre: 'individuel', unite: 'pct', source: null }, precedent: null, cloture: null }]));
    expect(k.ratioSolvabilite).toBeCloseTo(0.1439, 6);
  });
  it('seul le coefficient de la lecture s’affiche : sans lui, aucun coefficient (avenant du 2026-11-15)', () => {
    // computeBankKpis donne « frais généraux ÷ PNB », une autre définition : jamais affichée.
    expect(appliquerLecture(kpis, null).costIncome).toBeNull();
    expect(appliquerLecture(kpis, { ...lecture([]), extrait: false } as LectureBancaire).costIncome).toBeNull();
    expect(appliquerLecture(kpis, lecture([])).costIncome).toBeNull();
  });
  it('sans lecture extraite : le reste est inchangé', () => {
    const k = appliquerLecture(kpis, null);
    expect(k.transformation).toBe(0.9);
    expect(k.ratioSolvabilite).toBeNull();
  });
});
