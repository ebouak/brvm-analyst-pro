import { describe, it, expect } from 'vitest';
import { reperesSurCourbe, echelleReguliere } from './reperes';

const dates = ['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26'];

describe('reperesSurCourbe', () => {
  it("cale chaque événement sur la première date de la courbe qui le suit", () => {
    const r = reperesSurCourbe(dates, [{ date: '2026-01-10', type: 'dividende', libelle: 'Dividende' }]);
    expect(r).toEqual([{ date: '2026-01-10', type: 'dividende', libelle: 'Dividende', x: '2026-01-12' }]);
  });
  it('écarte les événements hors de la période tracée', () => {
    const r = reperesSurCourbe(dates, [
      { date: '2025-12-01', type: 'resultats', libelle: 'a' },
      { date: '2026-03-01', type: 'resultats', libelle: 'b' },
    ]);
    expect(r).toEqual([]);
  });
  it("garde un événement daté le jour même d'une date de courbe", () => {
    expect(reperesSurCourbe(dates, [{ date: '2026-01-19', type: 'resultats', libelle: 'r' }])[0]!.x).toBe('2026-01-19');
  });
  it('ignore les dates absentes ou invalides, et trie par date', () => {
    const r = reperesSurCourbe(dates, [
      { date: '', type: 'resultats', libelle: 'vide' },
      { date: '2026-01-20', type: 'dividende', libelle: 'd' },
      { date: '2026-01-06', type: 'resultats', libelle: 'r' },
    ]);
    expect(r.map((e) => e.libelle)).toEqual(['r', 'd']);
  });
  it('sans courbe, aucun repère', () => {
    expect(reperesSurCourbe([], [{ date: '2026-01-01', type: 'resultats', libelle: 'r' }])).toEqual([]);
  });
});

describe('echelleReguliere', () => {
  it('graduations régulières qui encadrent les données (barres positives)', () => {
    const e = echelleReguliere(0, 1.79e9);
    expect(e.ticks[0]).toBe(0);
    expect(e.max).toBeGreaterThanOrEqual(1.79e9);
    const pas = e.ticks[1]! - e.ticks[0]!;
    e.ticks.forEach((t, i) => expect(t).toBeCloseTo(e.ticks[0]! + i * pas, 3));
  });
  it('inclut zéro et des pas égaux quand des valeurs sont négatives', () => {
    const e = echelleReguliere(-2e9, 4.6e9);
    expect(e.ticks).toContain(0);
    expect(e.min).toBeLessThanOrEqual(-2e9);
    expect(e.max).toBeGreaterThanOrEqual(4.6e9);
    const pas = e.ticks[1]! - e.ticks[0]!;
    for (let i = 1; i < e.ticks.length; i++) expect(e.ticks[i]! - e.ticks[i - 1]!).toBeCloseTo(pas, 3);
  });
  it('pas « rond » : 1, 2, 2,5 ou 5 fois une puissance de dix', () => {
    const { pas } = echelleReguliere(0, 1.79e9);
    const m = pas / 10 ** Math.floor(Math.log10(pas));
    expect([1, 2, 2.5, 5, 10]).toContain(Math.round(m * 100) / 100);
  });
  it('tout à zéro : une échelle valide', () => {
    const e = echelleReguliere(0, 0);
    expect(e.max).toBeGreaterThan(e.min);
  });
});
