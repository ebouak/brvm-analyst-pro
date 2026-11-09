import { describe, it, expect } from 'vitest';
import { decider } from '../src/conseiller/decision.js';
import { evaluerSeance } from '../src/conseiller/evaluerSeance.js';
import { indiceEquipondere } from '../src/conseiller/indice.js';
import { univers } from './conseillerFabrique.js';

const sc = (xs: (number | null)[]) => ({ valorisation: xs[0] ?? null, qualite: xs[1] ?? null, rendement: xs[2] ?? null, tendance: xs[3] ?? null, risque: xs[4] ?? null });

describe('decider', () => {
  it('Acheter quand 3 familles ≥ +1/3 et aucune ≤ −2/3', () => {
    expect(decider(sc([0.5, 0.4, 0.34, 0, -0.5]), 'A').action).toBe('acheter');
  });
  it('Conserver si une famille s oppose fortement', () => {
    expect(decider(sc([0.5, 0.4, 0.34, 0, -0.7]), 'A').action).toBe('conserver');
  });
  it('Vendre symétriquement', () => {
    expect(decider(sc([-0.5, -0.4, -0.34, 0, 0.5]), 'B').action).toBe('vendre');
  });
  it('Conserver (liquidité) en classe C ou D, quels que soient les scores', () => {
    const r = decider(sc([0.9, 0.9, 0.9, 0.9, 0.9]), 'D');
    expect(r.action).toBe('conserver');
    expect(r.raison).toBe('liquidite');
  });
  it('Abstention sous 2 familles disponibles', () => {
    expect(decider(sc([0.9, null, null, null, null]), 'A').raison).toBe('abstention');
  });
  it('Classe de liquidité inconnue : pas de recommandation active', () => {
    expect(decider(sc([0.9, 0.9, 0.9, 0.9, 0.9]), null).raison).toBe('liquidite');
  });
});

describe('evaluerSeance', () => {
  it('est déterministe et triée par code', () => {
    const d = univers(200, Array.from({ length: 20 }, (_, k) => (k - 10) / 20));
    const ind = indiceEquipondere(d);
    const a = evaluerSeance(d, ind, d.calendrier[190]!);
    const b = evaluerSeance(d, ind, d.calendrier[190]!);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.map((x) => x.code)).toEqual([...a.map((x) => x.code)].sort());
  });
});
