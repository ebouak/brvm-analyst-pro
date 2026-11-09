import { describe, it, expect } from 'vitest';
import { datesRebalancement, ecartsParDate, verdictBanc, PROTOCOLE } from '../src/conseiller/banc.js';
import { calendrier } from './conseillerFabrique.js';

describe('datesRebalancement', () => {
  it('prend une date toutes les 20 séances, avec 21 séances de recul à la fin', () => {
    const cal = calendrier(100);
    const ds = datesRebalancement(cal, cal[0]!, 20);
    expect(ds[0]).toBe(cal[0]);
    expect(ds[1]).toBe(cal[20]);
    expect(cal.indexOf(ds.at(-1)!) + 1 + 20 < cal.length).toBe(true);
  });
});

describe('ecartsParDate', () => {
  it('fait la moyenne Acheter − moyenne Vendre, coûts déduits, et saute une date sans les deux', () => {
    const r = ecartsParDate([
      { date: 'd1', achats: [0.05, 0.03], ventes: [0.01] },
      { date: 'd2', achats: [0.02], ventes: [] },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.ecart).toBeCloseTo(0.04 - 0.01 - PROTOCOLE.cout, 10);
  });
});

describe('verdictBanc', () => {
  it('« prouvé » si la borne basse unilatérale dépasse 0 avec ≥ 30 dates', () => {
    expect(verdictBanc(Array.from({ length: 60 }, (_, i) => 0.02 + (i % 3) * 0.001)).verdict).toBe('prouve');
  });
  it('« non prouvé » sur du bruit centré', () => {
    expect(verdictBanc(Array.from({ length: 60 }, (_, i) => (i % 2 ? 0.05 : -0.05))).verdict).toBe('non_prouve');
  });
  it('« insuffisant » sous 30 dates', () => {
    expect(verdictBanc([0.1, 0.1, 0.1]).verdict).toBe('insuffisant');
  });
});
