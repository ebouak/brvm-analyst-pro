import { describe, expect, it } from 'vitest';
import {
  calculerStatsSeuils,
  construireSyntheseBacktest,
  intervalleBootstrapDeterministe,
  simulerPortefeuilleResilient,
  simulerStrategiesIndice,
} from '../src/stress/pure/backtesting.js';
import type { PortefeuilleResilientActionInput } from '../src/stress/pure/backtestingTypes.js';
import type { PointIndice } from '../src/stress/pure/types.js';

function mkDates(count: number, debutIso = '2007-01-02'): string[] {
  const out: string[] = [];
  let t = Date.parse(`${debutIso}T00:00:00Z`);
  while (out.length < count) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
    t += 86_400_000;
  }
  return out;
}

function mkSerieMultiCrises(count = 4500): PointIndice[] {
  const dates = mkDates(count);
  let val = 200;
  return dates.map((d, i) => {
    if (i >= 300 && i < 420) val *= 0.9965; // ~ -34 %
    else if (i >= 420 && i < 820) val *= 1.0017;
    else if (i >= 1500 && i < 1620) val *= 0.9978; // ~ -23 %
    else if (i >= 1620 && i < 2000) val *= 1.0015;
    else if (i >= 2800 && i < 3100) val *= 0.9982; // ~ -42 %
    else if (i >= 3100 && i < 3900) val *= 1.0016;
    else val *= 1.0004 + 0.0015 * Math.sin(i / 20);
    return { date_marche: d, valeur: Math.round(val * 100) / 100 };
  });
}

describe('Historical Backtesting Engine — contrôles anti-biais', () => {
  it('zéro look-ahead : modifier les cours futurs après t ne change aucune entrée ni statistique passée', () => {
    const serieA = mkSerieMultiCrises(2200);
    const serieB = serieA.map((p, idx) =>
      idx > 1000 ? { ...p, valeur: p.valeur * 0.4 } : p,
    );

    const statsA = calculerStatsSeuils(serieA, { seuils: [-10, -20] });
    const statsB = calculerStatsSeuils(serieB, { seuils: [-10, -20] });

    const s10A = statsA.find((s) => s.seuil_pct === -10)!.horizons.find((h) => h.horizon_mois === 3)!;
    const s10B = statsB.find((s) => s.seuil_pct === -10)!.horizons.find((h) => h.horizon_mois === 3)!;

    // Toute observation dont date_entree <= serieA[850] doit être rigoureusement identique
    const cutoff = serieA[850]!.date_marche;
    const obsA = s10A.independant.observations.filter((o) => o.date_entree <= cutoff);
    const obsB = s10B.independant.observations.filter((o) => o.date_entree <= cutoff);
    expect(obsA.length).toBeGreaterThan(0);
    expect(obsB).toEqual(obsA);

    // Même règle sur simulerStrategiesIndice : valeur base100 avant indice 1000 identique
    const stratsA = simulerStrategiesIndice(serieA, { fraisAllerRetourPct: 1.5 });
    const stratsB = simulerStrategiesIndice(serieB, { fraisAllerRetourPct: 1.5 });
    const s1A = stratsA.find((s) => s.id === 'seuil_unique')!;
    const s1B = stratsB.find((s) => s.id === 'seuil_unique')!;
    const dateCut = serieA[950]!.date_marche;
    expect(
      s1A.courbe_base100.filter((c) => c.date < dateCut).map((c) => c.base100).slice(0, 5),
    ).toEqual(
      s1B.courbe_base100.filter((c) => c.date < dateCut).map((c) => c.base100).slice(0, 5),
    );
  });

  it('dé-chevauchement strict : n_independants < n_franchissements lors de rebonds proches du seuil', () => {
    const dates = mkDates(650);
    // Oscille autour de -10 % plusieurs fois en quelques jours puis remonte sur 12 mois
    const serie: PointIndice[] = dates.map((d, i) => {
      let val = 100;
      if (i >= 20 && i <= 120) {
        // Alterne entre 91 (-9 %) et 89 (-11 %) toutes les 4 séances
        val = i % 4 === 0 ? 89 : 91;
      } else if (i > 120) {
        val = 91 + (i - 120) * 0.1;
      }
      return { date_marche: d, valeur: val };
    });

    const res = calculerStatsSeuils(serie, { seuils: [-10], clusteringJours: 90 });
    const s10 = res[0]!;
    const h3 = s10.horizons.find((h) => h.horizon_mois === 3)!;
    expect(s10.nb_franchissements_total).toBeGreaterThan(5);
    expect(h3.tous_franchissements.n).toBeGreaterThan(5);
    expect(h3.independant.n).toBeLessThan(h3.tous_franchissements.n);
    expect(h3.independant.n).toBeLessThanOrEqual(2);
  });

  it('bootstrap déterministe & garde-fou N < 5 sans intervalle extrapolé', () => {
    expect(intervalleBootstrapDeterministe([5, 10, 12, 8])).toBeNull();
    const ic1 = intervalleBootstrapDeterministe([2, 8, 12, -3, 15, 7, 9], 1000, 42);
    const ic2 = intervalleBootstrapDeterministe([2, 8, 12, -3, 15, 7, 9], 1000, 42);
    expect(ic1).not.toBeNull();
    expect(ic1).toEqual(ic2);

    // Vérifier le flag echantillon_faible sur une série avec un seul épisode
    const dates = mkDates(450);
    const serie = dates.map((d, i) => ({
      date_marche: d,
      valeur: i >= 50 && i < 70 ? 80 : 100,
    }));
    const s20 = calculerStatsSeuils(serie, { seuils: [-20] })[0]!;
    const h3 = s20.horizons.find((h) => h.horizon_mois === 3)!;
    expect(h3.independant.n).toBe(1);
    expect(h3.independant.echantillon_faible).toBe(true);
    expect(h3.independant.statut_statistique).toBe('insuffisant');
    expect(h3.independant.ic95_moyenne).toBeNull();
  });

  it('impact strictement négatif des frais sur le rendement final et découpage walk-forward sans chevauchement', () => {
    const serie = mkSerieMultiCrises(4500);
    const sansFrais = simulerStrategiesIndice(serie, { fraisAllerRetourPct: 0, splitWalkForwardDate: '2018-01-01' });
    const avecFrais = simulerStrategiesIndice(serie, { fraisAllerRetourPct: 2.0, splitWalkForwardDate: '2018-01-01' });

    for (const id of ['buy_and_hold', 'seuil_unique', 'achat_paliers'] as const) {
      const a0 = sansFrais.find((s) => s.id === id)!;
      const a2 = avecFrais.find((s) => s.id === id)!;
      expect(a2.globale!.rendement_total_pct).toBeLessThan(a0.globale!.rendement_total_pct);
      expect(a2.globale!.cout_frais_pct).toBeGreaterThan(0);
      expect(a2.in_sample).not.toBeNull();
      expect(a2.out_of_sample).not.toBeNull();
      expect(a2.in_sample!.fin < '2018-01-01').toBe(true);
      expect(a2.out_of_sample!.debut >= '2018-01-01').toBe(true);
    }

    // Série récente (< 2018 absente) -> in_sample null proprement géré
    const recente = serie.filter((p) => p.date_marche >= '2023-01-01');
    const synthRec = construireSyntheseBacktest(recente, { indiceCode: 'BRVM30' });
    expect(synthRec.strategies[0]!.in_sample).toBeNull();
  });

  it('Stratégie 4 respecte strictement le lag de publication au 1er juillet Y+1', () => {
    const dates = mkDates(550, '2022-01-03');
    const mkAction = (code: string, rn2022: number): PortefeuilleResilientActionInput => ({
      code,
      designation: code,
      cours: dates.map((d, i) => ({ date_marche: d, cours_ajuste: 1000 + i })),
      fondamentaux: [
        { exercice: 2020, resultat_net: 10e9, capitaux_propres: 100e9, date_publication: null },
        { exercice: 2021, resultat_net: 12e9, capitaux_propres: 100e9, date_publication: null },
        // Résultat négatif en 2022 qui ne sera visible qu'au 2023-07-01
        { exercice: 2022, resultat_net: rn2022, capitaux_propres: 100e9, date_publication: null },
      ],
      dividendes: [{ exercice: 2021, montant_net: 50, ex_date: null }],
    });

    // Sans comptes 2022 publiés avant 2023-07-01, les 3 actions avec RN négatif en 2022 restent éligibles en 2022 et début 2023
    const actionsOk = [mkAction('A', -5e9), mkAction('B', -5e9), mkAction('C', -5e9)];
    const r = simulerPortefeuilleResilient(actionsOk, { debut: '2022-01-03', fraisAllerRetourPct: 1.5 });
    expect(r.disponible).toBe(true);
    expect(r.globale!.nb_entrees).toBeGreaterThanOrEqual(4); // trimestres 2022 Q1..Q4 + 2023 Q1..Q2 avant 2023-07-01
  });
});
