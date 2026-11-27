import { describe, expect, it } from 'vitest';
import { calculerDrawdowns, classifierDrawdown, detecterEpisodes } from '../src/stress/pure/drawdowns.js';
import type { PointIndice } from '../src/stress/pure/types.js';

function genererSerieDates(valeurs: number[], debut = '2024-01-01'): PointIndice[] {
  const out: PointIndice[] = [];
  let t = Date.parse(`${debut}T00:00:00Z`);
  for (const v of valeurs) {
    // Sauter week-ends
    while (new Date(t).getUTCDay() === 0 || new Date(t).getUTCDay() === 6) {
      t += 86_400_000;
    }
    out.push({ date_marche: new Date(t).toISOString().slice(0, 10), valeur: v });
    t += 86_400_000;
  }
  return out;
}

describe('Historical Crisis Engine — drawdowns & épisodes', () => {
  it('calcule les drawdowns sans look-ahead depuis le sommet précédent', () => {
    const serie = genererSerieDates([100, 120, 108, 96, 114, 130, 117]);
    const dds = calculerDrawdowns(serie);

    expect(dds.map((d) => d.sommet_precedent)).toEqual([100, 120, 120, 120, 120, 130, 130]);
    expect(dds[2]!.drawdown_pct).toBeCloseTo(-10, 4);
    expect(dds[3]!.drawdown_pct).toBeCloseTo(-20, 4);
    expect(dds[5]!.drawdown_pct).toBe(0);
    expect(dds[6]!.drawdown_pct).toBeCloseTo(-10, 4);
  });

  it('classe correctement les six niveaux de gravité', () => {
    expect(classifierDrawdown(-5)).toBe('correction_moderee');
    expect(classifierDrawdown(-10)).toBe('correction_significative');
    expect(classifierDrawdown(-15)).toBe('correction_severe');
    expect(classifierDrawdown(-20)).toBe('marche_baissier');
    expect(classifierDrawdown(-30)).toBe('crise_majeure');
    expect(classifierDrawdown(-40)).toBe('crise_extreme');
  });

  it('exige joursConfirmationReprise séances consécutives pour clore un épisode et évite le découpage artificiel', () => {
    // Sommet à 100, baisse à 80 (-20 %), faux retour à 100 sur 2 séances puis rechute à 75 (-25 %),
    // puis récupération définitive maintenue sur 5 séances consécutives.
    const vals = [
      100, 95, 90, 80, 88, 100, 100, 85, 75, 82, 90, 95,
      100, 101, 102, 103, 104, 105,
    ];
    const serie = genererSerieDates(vals);
    const eps = detecterEpisodes(serie, 'BRVMC', {
      seuilDeclenchementPct: -10,
      joursConfirmationReprise: 5,
      seuilRebondIntermediairePct: 5,
    });

    expect(eps).toHaveLength(1);
    const ep = eps[0]!;
    expect(ep.statut).toBe('termine');
    expect(ep.valeur_sommet).toBe(100);
    expect(ep.valeur_creux).toBe(75);
    expect(ep.perte_max_pct).toBeCloseTo(-25, 4);
    // Le rebond intermédiaire (80 -> 100 = +25 %) avant le creux définitif à 75 est comptabilisé
    expect(ep.nb_rebonds_intermediaires).toBe(1);
    expect(ep.amplitude_max_rebond_pct).toBeCloseTo(25, 4);
    expect(ep.nb_seances_baisse).toBe(8); // index 8 (75) - index 0 (100)
    expect(ep.nb_seances_rebond).toBe(4); // index 12 (100 confirmé) - index 8 (75)
    expect(ep.date_recuperation).toBe(serie[12]!.date_marche);
    expect(ep.trajectoire_base100[0]!.base100).toBe(100);
  });

  it('marque un épisode sans récupération confirmée comme en_cours et calcule les rebonds calendaires disponibles', () => {
    // 1 an de séances journalières : sommet 200 -> creux 160 (-20 %), puis remontée partielle à 176 (+10 % post-creux) à +95j
    const points: PointIndice[] = [];
    const t0 = Date.parse('2025-01-01T00:00:00Z');
    for (let j = 0; j < 200; j++) {
      const date = new Date(t0 + j * 86_400_000).toISOString().slice(0, 10);
      let valeur = 200;
      if (j > 0 && j <= 20) valeur = 200 - j * 2; // j=20 => 160 (-20 %)
      else if (j > 20) valeur = 160 + Math.min(20, (j - 20) * 0.2); // max 180 (< 200)
      points.push({ date_marche: date, valeur });
    }

    const eps = detecterEpisodes(points, 'BRVMC', { seuilDeclenchementPct: -10 });
    expect(eps).toHaveLength(1);
    const ep = eps[0]!;
    expect(ep.statut).toBe('en_cours');
    expect(ep.date_recuperation).toBeNull();
    expect(ep.rebond_1m_pct).toBeCloseTo(((166 - 160) / 160) * 100, 2);
    expect(ep.rebond_3m_pct).toBeCloseTo(((178.2 - 160) / 160) * 100, 1);
    expect(ep.rebond_12m_pct).toBeNull();
    expect(ep.rebond_24m_pct).toBeNull();
  });
});
