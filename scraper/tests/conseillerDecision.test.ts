import { describe, it, expect } from 'vitest';
import { decider, deciderCoeurPrix } from '../src/conseiller/decision.js';
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
  it('est déterministe pour les deux règles, et la règle par défaut est cœur prix', () => {
    const d = univers(200, Array.from({ length: 20 }, (_, k) => (k - 10) / 20));
    const ind = indiceEquipondere(d);
    const date = d.calendrier[190]!;
    for (const r of ['coeur_prix', 'cinq_familles'] as const) {
      expect(JSON.stringify(evaluerSeance(d, ind, date, undefined, r))).toBe(JSON.stringify(evaluerSeance(d, ind, date, undefined, r)));
    }
    expect(JSON.stringify(evaluerSeance(d, ind, date))).toBe(JSON.stringify(evaluerSeance(d, ind, date, undefined, 'coeur_prix')));
  });
});

describe('deciderCoeurPrix', () => {
  it('Acheter si tendance et risque ≥ +1/3', () => {
    const r = deciderCoeurPrix(sc([null, null, null, 0.4, 0.34]), 'A');
    expect(r).toMatchObject({ action: 'acheter', concordantes: 2, disponibles: 2 });
  });
  it('Vendre si tendance et risque ≤ −1/3', () => {
    const r = deciderCoeurPrix(sc([0.9, 0.9, 0.9, -0.4, -0.34]), 'B');
    expect(r).toMatchObject({ action: 'vendre', concordantes: 2, disponibles: 2 });
  });
  it('Conserver (liquidité) en C, D ou classe inconnue', () => {
    for (const c of ['C', 'D', null] as const) {
      const r = deciderCoeurPrix(sc([null, null, null, 0.9, 0.9]), c);
      expect(r).toMatchObject({ action: 'conserver', raison: 'liquidite', concordantes: 0 });
    }
  });
  it('Conserver (abstention) si tendance ou risque manque', () => {
    expect(deciderCoeurPrix(sc([null, null, null, null, 0.9]), 'A')).toMatchObject({ action: 'conserver', raison: 'abstention', disponibles: 1 });
    expect(deciderCoeurPrix(sc([0.9, 0.9, 0.9, 0.9, null]), 'A')).toMatchObject({ action: 'conserver', raison: 'abstention', disponibles: 1 });
  });
  it('Conserver (pas de concordance) sinon', () => {
    expect(deciderCoeurPrix(sc([null, null, null, 0.4, 0.2]), 'A')).toMatchObject({ action: 'conserver', raison: 'pas_de_concordance', concordantes: 0, disponibles: 2 });
    expect(deciderCoeurPrix(sc([null, null, null, 0.4, -0.4]), 'A').action).toBe('conserver');
  });
});
