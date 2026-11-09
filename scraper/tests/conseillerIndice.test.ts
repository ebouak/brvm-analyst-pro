import { describe, it, expect } from 'vitest';
import { indiceEquipondere, perfIndice } from '../src/conseiller/indice.js';
import { calendrier, serie } from './conseillerFabrique.js';

describe('indiceEquipondere', () => {
  const cal = calendrier(30);
  const donnees = (series: [string, ReturnType<typeof serie>][]) => ({ calendrier: cal, series: new Map(series), comptes: [], dividendes: [], familles: new Map() });
  it('moyenne les rendements du jour des valeurs échangées, cotées depuis ≥ 20 séances', () => {
    const a = serie(cal, cal.map((_, i) => 100 * 1.01 ** i));
    const b = serie(cal, cal.map(() => 100));
    const ind = indiceEquipondere(donnees([['A', a], ['B', b]]));
    expect(ind.rendements.get(cal[25]!)).toBeCloseTo(0.005, 6);
    expect(ind.rendements.get(cal[5]!)).toBeUndefined();
  });
  it('exclut une valeur non échangée ce jour-là', () => {
    const a = serie(cal, cal.map((_, i) => 100 * 1.01 ** i));
    const b = serie(cal, cal.map(() => 100), [25]);
    const ind = indiceEquipondere(donnees([['A', a], ['B', b]]));
    expect(ind.rendements.get(cal[25]!)).toBeCloseTo(0.01, 6);
  });
  it('perfIndice compose les rendements entre deux dates', () => {
    const a = serie(cal, cal.map((_, i) => 100 * 1.01 ** i));
    const ind = indiceEquipondere(donnees([['A', a]]));
    expect(perfIndice(ind, cal, cal[22]!, cal[25]!)).toBeCloseTo(1.01 ** 3 - 1, 6);
  });
});
