import { describe, it, expect } from 'vitest';
import { sautsSuspects, partFigee, radiees, couvertureParAn } from '../src/conseiller/audit.js';
import { calendrier, serie } from './conseillerFabrique.js';

const cal = calendrier(40);

describe('audit', () => {
  it('repère une division par 2 et une division par 10', () => {
    const s = serie(cal, cal.map((_, i) => (i < 10 ? 1000 : i < 20 ? 500 : 50)));
    expect(sautsSuspects(new Map([['A', s]])).map((x) => x.date)).toEqual([cal[10], cal[20]]);
  });
  it('mesure la part de séances non échangées', () => {
    expect(partFigee(serie(cal, cal.map(() => 100), [0, 1, 2, 3]))).toBeCloseTo(0.1);
  });
  it('compte aussi comme figée une séance au cours inchangé', () => {
    // 10 séances : cours identique à la veille pour les indices 1 à 4 -> 4 figées
    expect(partFigee(serie(cal.slice(0, 10), [100, 100, 100, 100, 100, 101, 102, 103, 104, 105]))).toBeCloseTo(0.4);
  });
  it('liste les codes sans cotation depuis plus de 30 jours calendaires', () => {
    const a = serie(cal, cal.map(() => 100));
    const b = serie(cal.slice(0, 5), [1, 1, 1, 1, 1]);
    expect(radiees(new Map([['A', a], ['B', b]]), cal.at(-1)!, 30)).toEqual(['B']);
  });
  it('compte les valeurs couvertes par année', () => {
    expect(couvertureParAn([{ code: 'A', annee: 2020 }, { code: 'B', annee: 2020 }, { code: 'A', annee: 2021 }])).toEqual({ 2020: 2, 2021: 1 });
  });
});
