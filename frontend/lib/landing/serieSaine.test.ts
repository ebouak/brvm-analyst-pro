import { describe, expect, it } from 'vitest';
import { serieSaine } from './serieSaine';

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
