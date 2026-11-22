import { describe, it, expect } from 'vitest';
import { recomposer, heureMaj, estEnDirect, valeursChangees } from './recomposer';

type Ligne = { code: string; cours_jour: number | null; variation_pct: number | null; designation: string; volume?: number | null };

const base: Ligne[] = [
  { code: 'SNTS', cours_jour: 15000, variation_pct: 1.2, designation: 'SONATEL', volume: 100 },
  { code: 'ETIT', cours_jour: 30, variation_pct: -0.5, designation: 'ECOBANK TG', volume: 5000 },
];

describe('recomposer', () => {
  it('garde les champs serveur et écrase les seules colonnes de marché', () => {
    const r = recomposer(base, [{ code: 'SNTS', cours_jour: 15100, variation_pct: 1.9 }]);
    expect(r[0]).toEqual({ code: 'SNTS', cours_jour: 15100, variation_pct: 1.9, designation: 'SONATEL', volume: 100 });
    expect(r[1]).toBe(base[1]);
  });

  it("ignore un code absent de la base : pas de ligne sans désignation", () => {
    const r = recomposer(base, [{ code: 'BBGC', cours_jour: 6750, variation_pct: 0 }]);
    expect(r.map((l) => l.code)).toEqual(['SNTS', 'ETIT']);
  });

  it("n'efface pas une valeur connue avec un null reçu", () => {
    const r = recomposer(base, [{ code: 'ETIT', cours_jour: null, variation_pct: null, volume: 6000 }]);
    expect(r[1]).toEqual({ ...base[1], volume: 6000 });
  });

  it('rend la même référence quand rien ne change', () => {
    const r = recomposer(base, [{ code: 'SNTS', cours_jour: 15000, variation_pct: 1.2 }]);
    expect(r[0]).toBe(base[0]);
  });

  it("garde l'ordre de la base", () => {
    const r = recomposer(base, [
      { code: 'ETIT', cours_jour: 31, variation_pct: 2 },
      { code: 'SNTS', cours_jour: 14900, variation_pct: 0.5 },
    ]);
    expect(r.map((l) => l.code)).toEqual(['SNTS', 'ETIT']);
  });
});

describe('estEnDirect', () => {
  const o = { enSeance: true, dateMarche: '2026-11-23', jour: '2026-11-23', majRecue: false };
  it('vrai en séance quand la page montre les cours du jour', () => {
    expect(estEnDirect(o)).toBe(true);
  });
  it('faux avant le premier relevé si la page montre la séance précédente', () => {
    expect(estEnDirect({ ...o, dateMarche: '2026-11-20' })).toBe(false);
  });
  it('devient vrai dès qu’un cours du jour est arrivé', () => {
    expect(estEnDirect({ ...o, dateMarche: '2026-11-20', majRecue: true })).toBe(true);
  });
  it('faux hors séance, ou sans date de séance (page statique)', () => {
    expect(estEnDirect({ ...o, enSeance: false })).toBe(false);
    expect(estEnDirect({ ...o, dateMarche: null })).toBe(false);
    expect(estEnDirect({ ...o, jour: null })).toBe(false);
  });
});

describe('valeursChangees', () => {
  const a = [{ code: 'SNTS', cours_jour: 4040, variation_pct: -1.2, volume: 10 }];
  it('détecte un cours, une variation ou un volume changé', () => {
    expect(valeursChangees(a, [{ ...a[0]!, cours_jour: 4050 }])).toBe(true);
    expect(valeursChangees(a, [{ ...a[0]!, volume: 11 }])).toBe(true);
  });
  it('ignore une simple recopie (relecture identique au retour d’onglet)', () => {
    expect(valeursChangees(a, [{ ...a[0]! }])).toBe(false);
  });
});

describe('heureMaj', () => {
  it('formate en HH:MM UTC', () => {
    expect(heureMaj(new Date('2026-11-23T09:05:00Z'))).toBe('09:05');
  });
});
