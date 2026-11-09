import { describe, it, expect } from 'vitest';
import { reconstituerExDate, rendementTotal } from '../src/conseiller/dividendes.js';
import { calendrier, serie } from './conseillerFabrique.js';
import type { Dividende } from '../src/conseiller/types.js';

const cal = calendrier(120);

describe('reconstituerExDate', () => {
  it('trouve la première baisse proche du montant (±20 %) dans les 60 séances', () => {
    const s = serie(cal, cal.map((_, i) => (i < 40 ? 1000 : 920)));
    expect(reconstituerExDate(s, 80, cal[10]!)).toBe(cal[40]);
  });
  it('renvoie null si aucune baisse ne correspond', () => {
    const s = serie(cal, cal.map(() => 1000));
    expect(reconstituerExDate(s, 80, cal[10]!)).toBeNull();
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
