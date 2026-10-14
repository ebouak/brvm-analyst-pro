import { describe, it, expect } from 'vitest';
import { lignesPerfDepuis, contributions, positionsSansCours, variationsDuJour, syntheseValorisee, secteursValorises, echantillonner } from './portefeuilleBloc';
import type { EnrichedPosition } from '@/lib/portfolio/derive';

const pos = (code: string, o: Partial<EnrichedPosition> = {}): EnrichedPosition => ({
  code, quantite: 10, pru: 1000, cours: 1100, valeur: 11000, investi: 10000, pnl: 1000, pnlPct: 0.1,
  poids: 0.5, secteur: 'Autre', isLiquidites: false, ...o,
});
const jour = [
  { code: 'SNTS', cours_jour: 1100, variation_pct: 1.2, date_marche: '2026-10-13' },
  { code: 'ORAC', cours_jour: 500, variation_pct: -0.5, date_marche: '2026-10-13' },
];

describe('lignesPerfDepuis', () => {
  it('cours et variation de la séance, liquidités exclues, cours manquant = null', () => {
    const r = lignesPerfDepuis([pos('SNTS'), pos('BOAN'), pos('LIQUIDITES', { isLiquidites: true })], jour);
    expect(r).toEqual([
      { code: 'SNTS', quantite: 10, cours: 1100, variationPct: 1.2, dateMarche: '2026-10-13' },
      { code: 'BOAN', quantite: 10, cours: null, variationPct: null, dateMarche: null },
    ]);
  });
});

describe('variationsDuJour', () => {
  it('table code → variation, absente = undefined', () => {
    const v = variationsDuJour(jour);
    expect(v.get('SNTS')).toBe(1.2);
    expect(v.get('XXXX')).toBeUndefined();
  });
});

describe('contributions', () => {
  it('triées de la plus forte à la plus faible, largeur relative au maximum absolu', () => {
    const r = contributions([pos('A', { pnl: 3000 }), pos('B', { pnl: -6000 }), pos('C', { pnl: 0 }), pos('L', { isLiquidites: true, pnl: 0 })]);
    expect(r.map((x) => x.code)).toEqual(['A', 'C', 'B']);
    expect(r.find((x) => x.code === 'B')!.largeur).toBe(1);
    expect(r.find((x) => x.code === 'A')!.largeur).toBe(0.5);
  });
  it('position sans cours exclue (sa plus-value serait fausse)', () => {
    const r = contributions([pos('A', { pnl: 3000 }), pos('Z', { cours: 0, valeur: 0, pnl: -10000 })]);
    expect(r.map((x) => x.code)).toEqual(['A']);
  });
});

describe('positionsSansCours', () => {
  it('cours nul ou non fini, hors liquidités', () => {
    expect(positionsSansCours([pos('A'), pos('Z', { cours: 0 }), pos('L', { isLiquidites: true, cours: 0 })])).toEqual(['Z']);
  });
});

describe('une seule séance, sans écrasement par null', () => {
  const deuxJours = [
    { code: 'SNTS', cours_jour: 1000, variation_pct: 5, date_marche: '2026-10-12' },
    { code: 'SNTS', cours_jour: 1100, variation_pct: 1.2, date_marche: '2026-10-13' },
  ];
  it('dateMarche : seules les lignes de cette séance comptent', () => {
    const l = lignesPerfDepuis([pos('SNTS')], deuxJours, '2026-10-13');
    expect(l[0].cours).toBe(1100);
    expect(l[0].variationPct).toBe(1.2);
    expect(l[0].dateMarche).toBe('2026-10-13');
    expect(variationsDuJour(deuxJours, '2026-10-13').get('SNTS')).toBe(1.2);
  });
  it('un doublon à variation null garde la valeur connue', () => {
    const dbl = [
      { code: 'SNTS', cours_jour: 1100, variation_pct: 1.2, date_marche: '2026-10-13' },
      { code: 'SNTS', cours_jour: 1100, variation_pct: null, date_marche: '2026-10-13' },
    ];
    expect(variationsDuJour(dbl).get('SNTS')).toBe(1.2);
    expect(lignesPerfDepuis([pos('SNTS')], dbl)[0].variationPct).toBe(1.2);
  });
});

describe('syntheseValorisee', () => {
  const liq = pos('LIQUIDITES', { isLiquidites: true, valeur: 5000, investi: 0, pnl: 0, cours: 0 });
  it('exclut une position sans cours de valeur, investi et pnl, et la nomme', () => {
    const r = syntheseValorisee([pos('SNTS'), pos('BOAN', { cours: 0, valeur: 0, pnl: -10000 })]);
    expect(r).toEqual({ valeur: 11000, investi: 10000, pnl: 1000, pnlPct: 0.1, exclus: ['BOAN'] });
  });
  it('inclut les liquidités dans la valeur', () => {
    const r = syntheseValorisee([pos('SNTS'), liq]);
    expect(r.valeur).toBe(16000);
    expect(r.exclus).toEqual([]);
  });
  it('aucune position valorisée : valeur 0, pnlPct null', () => {
    const r = syntheseValorisee([pos('BOAN', { cours: 0, valeur: 0, pnl: -10000 })]);
    expect(r.valeur).toBe(0);
    expect(r.pnlPct).toBeNull();
    expect(r.exclus).toEqual(['BOAN']);
  });
});

describe('secteursValorises', () => {
  it('poids recalculés sur le sous-ensemble valorisé, somme = 1, tri décroissant', () => {
    const r = secteursValorises([
      pos('A', { secteur: 'Banque', valeur: 3000 }),
      pos('B', { secteur: 'Telecom', valeur: 1000 }),
      pos('C', { secteur: 'Autre', cours: 0, valeur: 0 }),
    ]);
    expect(r.map((x) => x.secteur)).toEqual(['Banque', 'Telecom']);
    expect(r.reduce((a, x) => a + x.poids, 0)).toBeCloseTo(1, 10);
  });
});

describe('echantillonner', () => {
  it('1000 points, max 365 : borné, premier et dernier conservés', () => {
    const pts = Array.from({ length: 1000 }, (_, i) => i);
    const r = echantillonner(pts, 365);
    expect(r.length).toBeLessThanOrEqual(365);
    expect(r[0]).toBe(0);
    expect(r[r.length - 1]).toBe(999);
  });
  it('10 points : inchangé', () => {
    const pts = Array.from({ length: 10 }, (_, i) => i);
    expect(echantillonner(pts)).toBe(pts);
  });
});
