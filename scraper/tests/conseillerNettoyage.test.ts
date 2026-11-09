import { describe, it, expect } from 'vitest';
import { nettoyerAllersRetours, detecterRuptures } from '../src/conseiller/nettoyage.js';
import { calendrier, serie } from './conseillerFabrique.js';
import type { Dividende } from '../src/conseiller/types.js';

const cal = calendrier(60);
const base = (f: (i: number) => number) => serie(cal, cal.map((_, i) => f(i)));

describe('nettoyerAllersRetours', () => {
  it('retire un aller-retour ÷2 puis ×2 sur 1 séance', () => {
    const { serie: s, retirees } = nettoyerAllersRetours(base((i) => (i === 20 ? 500 : 1000)));
    expect(retirees).toEqual([cal[20]]);
    expect(s.dates).not.toContain(cal[20]);
    expect(s.dates.length).toBe(59);
    expect(s.cours.every((c) => c === 1000)).toBe(true);
    expect(s.pos.get(cal[21]!)).toBe(20);
    expect(s.variations.length).toBe(59);
  });
  it('retire un aller-retour sur 4 séances', () => {
    const { serie: s, retirees } = nettoyerAllersRetours(base((i) => (i >= 20 && i < 24 ? 500 : 1000)));
    expect(retirees).toEqual([cal[20], cal[21], cal[22], cal[23]]);
    expect(s.dates.length).toBe(56);
  });
  it('ne retire pas une baisse durable de ÷2', () => {
    const { serie: s, retirees } = nettoyerAllersRetours(base((i) => (i < 20 ? 1000 : 500)));
    expect(retirees).toEqual([]);
    expect(s.dates.length).toBe(60);
  });
  it('laisse une série normale inchangée et recalcule les variations', () => {
    const o = base((i) => 1000 + i);
    const { serie: s, retirees } = nettoyerAllersRetours(o);
    expect(retirees).toEqual([]);
    expect(s.cours).toEqual(o.cours);
    expect(s.variations[1]).toBeCloseTo((1001 / 1000 - 1) * 100, 9);
  });
});

describe('detecterRuptures', () => {
  it('une baisse de 50 % sans dividende est une rupture', () => {
    const r = detecterRuptures(base((i) => (i < 30 ? 1000 : 500)), []);
    expect([...r]).toEqual([cal[30]]);
  });
  it('une baisse de 42 % expliquée par un dividende ce jour-là n en est pas une', () => {
    const div: Dividende[] = [{ code: 'A', exercice: 2019, montant: 420, disponibleLe: cal[1]!, exDate: cal[30]! }];
    expect(detecterRuptures(base((i) => (i < 30 ? 1000 : 580)), div).size).toBe(0);
  });
  it('un dividende dont le montant ne correspond pas n explique pas la baisse', () => {
    const div: Dividende[] = [{ code: 'A', exercice: 2019, montant: 100, disponibleLe: cal[1]!, exDate: cal[30]! }];
    expect(detecterRuptures(base((i) => (i < 30 ? 1000 : 580)), div).size).toBe(1);
  });
  it('une série normale n a pas de rupture', () => {
    expect(detecterRuptures(base((i) => 1000 + i), []).size).toBe(0);
  });
});
