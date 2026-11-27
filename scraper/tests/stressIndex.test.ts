import { describe, expect, it } from 'vitest';
import { calculerSerieStressIndex, classifierRegimeStress } from '../src/stress/pure/stressIndex.js';
import type { ActionSeanceStressInput } from '../src/stress/pure/stressIndexTypes.js';
import type { PointIndice } from '../src/stress/pure/types.js';

function mkDates(count: number): string[] {
  const out: string[] = [];
  let t = Date.UTC(2026, 0, 2);
  while (out.length < count) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
    t += 86_400_000;
  }
  return out;
}

describe('BRVM Market Stress Index (0-100) — moteur pur', () => {
  it('reste borné entre 0 et 100, monte en phase de stress et renormalise proprement en cas de données partielles', () => {
    const dates = mkDates(100);
    // 50 séances de hausse calme puis 50 séances de baisse marquée (-22 %)
    const indice: PointIndice[] = dates.map((d, i) => ({
      date_marche: d,
      valeur: i < 50 ? 400 + i * 2 : 500 - (i - 50) * 2.2,
    }));

    const actions: ActionSeanceStressInput[] = [];
    for (let i = 0; i < dates.length; i++) {
      const d = dates[i]!;
      const enBaisse = i >= 50;
      for (let k = 0; k < 15; k++) {
        actions.push({
          date_marche: d,
          code: `ACT${k}`,
          secteur: k < 8 ? 'Services financiers' : 'Industriels',
          capitalisation: 50_000_000_000,
          cours_jour: enBaisse ? 2000 - (i - 50) * 12 : 1800 + i * 4,
          variation_pct: enBaisse ? (k < 13 ? -1.4 : 0.3) : k < 11 ? 0.8 : -0.4,
          volume: enBaisse ? 5000 : 2000,
        });
      }
    }

    const nerv = dates.map((d, i) => ({
      date_marche: d,
      valeur: i < 50 ? 7.2 : 16.5,
      rang: i < 50 ? 15 : 96,
    }));

    const res = calculerSerieStressIndex(indice, actions, nerv);
    expect(res).toHaveLength(100);

    const calme = res[45]!;
    const stresse = res[99]!;
    expect(calme.stress_index).toBeGreaterThanOrEqual(0);
    expect(calme.stress_index).toBeLessThan(25);
    expect(classifierRegimeStress(calme.stress_index)).toBe('faible_tension');

    expect(stresse.stress_index).toBeGreaterThan(65);
    expect(stresse.stress_index).toBeLessThanOrEqual(100);
    expect(stresse.couverture_composantes_pct).toBe(100);
    expect(stresse.nb_composantes_actives).toBe(6);
    expect(stresse.variation_20j_pts).not.toBeNull();

    // Test de renormalisation sans actions ni BRVM-V (seuls drawdown + vol BRVMC + momentum disponibles)
    const partiel = calculerSerieStressIndex(indice, [], []);
    const pFin = partiel.at(-1)!;
    expect(pFin.nb_composantes_actives).toBe(3);
    expect(pFin.couverture_composantes_pct).toBe(50);
    const sommePoidsEff = Object.values(pFin.composantes).reduce((s, c) => s + c.poids_effectif, 0);
    expect(sommePoidsEff).toBeCloseTo(1, 3);
  });

  it('zéro look-ahead : modifier le futur ne modifie pas le Stress Index à une date antérieure', () => {
    const dates = mkDates(80);
    const sA: PointIndice[] = dates.map((d, i) => ({ date_marche: d, valeur: 400 + i }));
    const sB: PointIndice[] = dates.map((d, i) => ({ date_marche: d, valeur: i <= 40 ? 400 + i : 200 }));

    const rA = calculerSerieStressIndex(sA, [], []);
    const rB = calculerSerieStressIndex(sB, [], []);
    expect(rA[40]!.stress_index).toBe(rB[40]!.stress_index);
    expect(rA[40]!.observables_marche).toEqual(rB[40]!.observables_marche);
  });
});
