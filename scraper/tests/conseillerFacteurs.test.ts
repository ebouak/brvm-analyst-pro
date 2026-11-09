import { describe, it, expect } from 'vitest';
import { scoresFamilles, MIN_COUVERTURE } from '../src/conseiller/facteurs.js';
import { indiceEquipondere } from '../src/conseiller/indice.js';
import { univers } from './conseillerFabrique.js';
import type { ComptesAnnuels } from '../src/conseiller/types.js';

describe('tendance', () => {
  it('classe en tête la valeur la plus haussière face à l indice', () => {
    const pentes = Array.from({ length: 20 }, (_, k) => (k - 10) / 20);
    const d = univers(200, pentes);
    const s = scoresFamilles(d, indiceEquipondere(d), d.calendrier[190]!);
    expect(s.get('V19')!.tendance).toBeCloseTo(1, 5);
    expect(s.get('V00')!.tendance).toBeCloseTo(-1, 5);
  });
  it('vaut null (tendance et risque) si moins de 60 % des séances sont échangées', () => {
    const d = univers(200, Array.from({ length: 20 }, (_, k) => k / 20));
    const v = d.series.get('V05')!;
    for (let i = 0; i < v.volumes.length; i++) if (i % 2 === 0) v.volumes[i] = 0;
    const s = scoresFamilles(d, indiceEquipondere(d), d.calendrier[190]!);
    expect(s.get('V05')!.tendance).toBeNull();
    expect(s.get('V05')!.risque).toBeNull();
  });
});

describe('valorisation', () => {
  const comptesPour = (codes: string[], dispo: string, cp: (k: number) => number): ComptesAnnuels[] =>
    codes.map((code, k) => ({ code, exercice: 2019, resultatNet: 1000 * (k + 1), capitauxPropres: cp(k), actions: 100, disponibleLe: dispo }));
  it('donne le meilleur score à la valeur la moins chère de sa famille comptable', () => {
    const d = univers(200, Array.from({ length: 20 }, () => 0));
    const comptes = comptesPour([...d.series.keys()], d.calendrier[10]!, (k) => 10000 * (k + 1));
    const s = scoresFamilles({ ...d, comptes }, indiceEquipondere(d), d.calendrier[190]!);
    expect(s.get('V19')!.valorisation).toBeCloseTo(1, 5);
    expect(s.get('V00')!.valorisation).toBeCloseTo(-1, 5);
  });
  it('ignore des comptes pas encore disponibles à la date', () => {
    const d = univers(200, Array.from({ length: 20 }, () => 0));
    const comptes = comptesPour([...d.series.keys()], '2099-01-01', () => 10000);
    const s = scoresFamilles({ ...d, comptes }, indiceEquipondere(d), d.calendrier[190]!);
    expect(s.get('V00')!.valorisation).toBeNull();
  });
  it(`est null partout sous ${MIN_COUVERTURE} valeurs couvertes`, () => {
    const d = univers(200, Array.from({ length: 20 }, () => 0));
    const comptes = comptesPour([...d.series.keys()].slice(0, 10), d.calendrier[10]!, () => 10000);
    const s = scoresFamilles({ ...d, comptes }, indiceEquipondere(d), d.calendrier[190]!);
    expect(s.get('V00')!.valorisation).toBeNull();
  });
});

describe('univers filtré', () => {
  it('retire les codes exclus du classement : le rang d une valeur retenue change', () => {
    const pentes = Array.from({ length: 20 }, (_, k) => (k - 10) / 20);
    const d = univers(200, pentes);
    const ind = indiceEquipondere(d);
    const date = d.calendrier[190]!;
    const tout = scoresFamilles(d, ind, date);
    const filtre = scoresFamilles(d, ind, date, (c) => c !== 'V19');
    expect(filtre.has('V19')).toBe(false);
    expect(tout.get('V18')!.tendance).not.toBeCloseTo(1, 5);
    expect(filtre.get('V18')!.tendance).toBeCloseTo(1, 5);
  });
});

describe('rendement du dividende', () => {
  const divs = (f: (k: number, code: string) => { exercice: number; montant: number }[]) => {
    const d = univers(200, Array.from({ length: 20 }, () => 0));
    const dividendes = [...d.series.keys()].flatMap((code, k) =>
      f(k, code).map((x) => ({ code, exercice: x.exercice, montant: x.montant, disponibleLe: d.calendrier[10]!, exDate: null })));
    return { d, dividendes };
  };
  it('ignore un dividende vieux de plus de 2 exercices', () => {
    const { d, dividendes } = divs((k) => [{ exercice: 2014, montant: 10 * (k + 1) }]);
    const s = scoresFamilles({ ...d, dividendes }, indiceEquipondere(d), d.calendrier[190]!);
    expect(s.get('V19')!.rendement).toBeNull();
  });
  it('additionne les lignes du même exercice (acompte et solde)', () => {
    const { d, dividendes } = divs((k) => (k === 0
      ? [{ exercice: 2019, montant: 10 }, { exercice: 2019, montant: 10 }]
      : [{ exercice: 2019, montant: 15 }]));
    const s = scoresFamilles({ ...d, dividendes }, indiceEquipondere(d), d.calendrier[190]!);
    expect(s.get('V00')!.rendement).toBeCloseTo(1, 5);
  });
  it('retient l exercice le plus récent seulement', () => {
    const { d, dividendes } = divs((k) => (k === 0
      ? [{ exercice: 2019, montant: 10 }, { exercice: 2018, montant: 500 }]
      : [{ exercice: 2019, montant: 15 }]));
    const s = scoresFamilles({ ...d, dividendes }, indiceEquipondere(d), d.calendrier[190]!);
    expect(s.get('V00')!.rendement).toBeCloseTo(-1, 5);
  });
});
