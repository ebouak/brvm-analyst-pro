import { describe, it, expect } from 'vitest';
import { reconstituerExDate, rendementTotal } from '../src/conseiller/dividendes.js';
import { calendrier, serie } from './conseillerFabrique.js';
import type { Dividende } from '../src/conseiller/types.js';

const cal = calendrier(120);

describe('reconstituerExDate', () => {
  it('trouve la première baisse proche du montant (±20 %) dans la fenêtre [apres ; jusqua]', () => {
    const s = serie(cal, cal.map((_, i) => (i < 40 ? 1000 : 920)));
    expect(reconstituerExDate(s, 80, cal[10]!, cal[119]!)).toBe(cal[40]);
  });
  it('renvoie null si aucune baisse ne correspond', () => {
    const s = serie(cal, cal.map(() => 1000));
    expect(reconstituerExDate(s, 80, cal[10]!, cal[119]!)).toBeNull();
  });
  it('ignore une baisse postérieure à jusqua', () => {
    const s = serie(cal, cal.map((_, i) => (i < 40 ? 1000 : 920)));
    expect(reconstituerExDate(s, 80, cal[10]!, cal[39]!)).toBeNull();
  });
  it('trouve un détachement fin septembre (FTSC, exercice 2024)', () => {
    const longCal = calendrier(1500);
    const iEx = longCal.findIndex((d) => d >= '2024-09-26');
    const s = serie(longCal, longCal.map((_, i) => (i < iEx ? 10000 : 8425)));
    expect(reconstituerExDate(s, 1726.56, '2024-04-01', '2024-12-31')).toBe(longCal[iEx]);
  });
});

describe('rendementTotal', () => {
  it('ajoute le dividende détaché dans la fenêtre', () => {
    const s = serie(cal, cal.map((_, i) => (i < 40 ? 1000 : 920)));
    const div: Dividende[] = [{ code: 'A', exercice: 2019, montant: 80, disponibleLe: cal[10]!, exDate: cal[40]! }];
    expect(rendementTotal(s, 'A', div, 30, 50)).toBeCloseTo(0, 6);
  });
  it('exclut (null) une fenêtre qui chevauche mai-août si un dividende sans ex-date est connu', () => {
    const s = serie(cal, cal.map(() => 1000));
    const div: Dividende[] = [{ code: 'A', exercice: 2019, montant: 80, disponibleLe: '2020-01-02', exDate: null }];
    const iMai = cal.findIndex((d) => d >= '2020-05-01');
    expect(rendementTotal(s, 'A', div, iMai - 5, iMai + 15)).toBeNull();
  });
  it('rend le rendement en cours seuls hors de ces cas', () => {
    const s = serie(cal, cal.map((_, i) => 1000 + i));
    expect(rendementTotal(s, 'A', [], 0, 10)).toBeCloseTo(10 / 1000, 6);
  });
});

describe('rendementTotal — ruptures', () => {
  it('vaut null sur une fenêtre qui contient une rupture', () => {
    const s = serie(cal, cal.map(() => 1000));
    expect(rendementTotal(s, 'A', [], 10, 30, new Set([cal[20]!]))).toBeNull();
    expect(rendementTotal(s, 'A', [], 10, 30, new Set([cal[30]!]))).toBeNull();
  });
  it('ignore une rupture hors de ]a ; b]', () => {
    const s = serie(cal, cal.map(() => 1000));
    expect(rendementTotal(s, 'A', [], 10, 30, new Set([cal[10]!, cal[31]!]))).toBeCloseTo(0, 9);
  });
});

describe('rendementTotal — portée de l exclusion', () => {
  const longCal = calendrier(1500);
  const s = serie(longCal, longCal.map(() => 1000));
  const fenetreMai = (an: number) => {
    const i = longCal.findIndex((d) => d >= `${an}-05-01`);
    return [i - 5, i + 15] as const;
  };
  it('un dividende non daté de l exercice 2015 n exclut pas mai 2024', () => {
    const div: Dividende[] = [{ code: 'A', exercice: 2015, montant: 80, disponibleLe: '2016-07-31', exDate: null }];
    const [a, b] = fenetreMai(2024);
    expect(rendementTotal(s, 'A', div, a, b)).not.toBeNull();
  });
  it('un dividende non daté de l exercice 2019 exclut mai 2020', () => {
    const div: Dividende[] = [{ code: 'A', exercice: 2019, montant: 80, disponibleLe: '2020-01-02', exDate: null }];
    const [a, b] = fenetreMai(2020);
    expect(rendementTotal(s, 'A', div, a, b)).toBeNull();
  });
  it('un cours à 0 (trou de collecte) donne null', () => {
    const z = serie(cal, cal.map((_, i) => (i === 5 ? 0 : 1000)));
    expect(rendementTotal(z, 'A', [], 5, 10)).toBeNull();
    expect(rendementTotal(z, 'A', [], 0, 5)).toBeNull();
  });
});
