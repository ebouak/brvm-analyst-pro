import { describe, expect, it } from 'vitest';
import { serieSaine, veilleIndice } from './serieSaine';

const P = (vs: number[]) => vs.map((v, i) => ({ d: `2026-01-${String(i + 1).padStart(2, '0')}`, v }));

describe('serieSaine', () => {
  it('laisse passer une série d’indice plausible', () => {
    expect(serieSaine(P([420, 421, 419.5, 425, 430])).length).toBe(5);
  });
  it('coupe au dernier point sain quand une ligne fausse précède (cas BRVMC 25/05/2026)', () => {
    const s = serieSaine(P([285.31, 421.02, 422.81, 425.54]));
    expect(s.map((p) => p.v)).toEqual([421.02, 422.81, 425.54]);
  });
  it('garde la fin de série même si le défaut est au milieu', () => {
    const s = serieSaine(P([420, 421, 900, 422, 423]));
    expect(s.map((p) => p.v)).toEqual([422, 423]);
  });
  it('série vide ou à un point : inchangée', () => {
    expect(serieSaine([])).toEqual([]);
    expect(serieSaine(P([500])).length).toBe(1);
  });
});

describe('veilleIndice', () => {
  // Valeurs réelles de BRVM Composite, séance du 6 novembre 2026.
  const serie = [{ d: '2026-11-04', v: 528.49 }, { d: '2026-11-05', v: 520.2 }, { d: '2026-11-06', v: 520.74 }];

  it('reprend la clôture précédente quand la colonne est vide', () => {
    expect(veilleIndice({ veille: null, variation: 0.1 }, serie, '2026-11-06')).toBe(520.2);
  });

  it('préfère la valeur publiée par la source', () => {
    expect(veilleIndice({ veille: 519, variation: 0.1 }, serie, '2026-11-06')).toBe(519);
  });

  it('refuse une clôture qui contredirait la variation publiée', () => {
    expect(veilleIndice({ veille: null, variation: 1.5 }, serie, '2026-11-06')).toBeNull();
  });

  it('accepte une variation inconnue : rien à contredire', () => {
    expect(veilleIndice({ veille: null, variation: null }, serie, '2026-11-06')).toBe(520.2);
  });

  it('ne devine rien sans séance précédente ni séance du jour', () => {
    expect(veilleIndice({ veille: null, variation: 0.1 }, serie.slice(2), '2026-11-06')).toBeNull();
    expect(veilleIndice({ veille: null, variation: 0.1 }, serie, '2026-11-07')).toBeNull();
  });
});
