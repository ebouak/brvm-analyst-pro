import { describe, it, expect } from 'vitest';
import { lignesPerfDepuis, contributions, positionsSansCours, variationsDuJour } from './portefeuilleBloc';
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
