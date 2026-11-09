import { describe, it, expect } from 'vitest';
import { classeA } from '../src/conseiller/liquiditeGlissante.js';
import { calendrier, serie } from './conseillerFabrique.js';

const cal = calendrier(60);

describe('classeA', () => {
  it('rend une classe avec 30 séances de calendrier jusqu à la date', () => {
    const s = serie(cal, cal.map((_, i) => 1000 + (i % 3)));
    expect(classeA(s, cal, cal[45]!)).not.toBeNull();
  });
  it('classe D une valeur presque jamais échangée', () => {
    const figees = cal.map((_, i) => i).filter((i) => i % 10 !== 0);
    const s = serie(cal, cal.map((_, i) => (i % 20 === 0 ? 1100 : 1000)), figees);
    expect(classeA(s, cal, cal[59]!)).toBe('D');
  });
  it('renvoie null avant 30 séances de calendrier', () => {
    const s = serie(cal, cal.map(() => 1000));
    expect(classeA(s, cal, cal[10]!)).toBeNull();
  });
});
