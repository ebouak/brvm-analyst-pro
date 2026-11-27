import { describe, expect, it } from 'vitest';
import { calculerSimilarite, classerSimilarites } from '../src/stress/pure/similarity.js';
import type { EpisodeCrise } from '../src/stress/pure/types.js';

function makeEpisode(
  dateSommet: string,
  perteMax: number,
  seances: number,
  dds: number[],
  avecMarche = true,
): EpisodeCrise {
  return {
    indice_code: 'BRVMC',
    seuil_pct: -10,
    niveau: perteMax <= -20 ? 'marche_baissier' : 'correction_significative',
    libelle: `Épisode ${dateSommet}`,
    date_sommet: dateSommet,
    valeur_sommet: 500,
    date_debut_correction: dateSommet,
    date_creux: dateSommet,
    valeur_creux: 500 * (1 + perteMax / 100),
    perte_max_pct: perteMax,
    nb_seances_baisse: seances,
    duree_calendaire_baisse: Math.round(seances * 1.4),
    nb_rebonds_intermediaires: 1,
    amplitude_max_rebond_pct: 4,
    date_recuperation: null,
    nb_seances_rebond: null,
    duree_totale_recuperation_jours: null,
    perf_cumulee_recuperation_pct: null,
    statut: 'termine',
    rebond_1m_pct: 3,
    rebond_3m_pct: 8,
    rebond_6m_pct: 12,
    rebond_12m_pct: 20,
    rebond_24m_pct: 30,
    contexte_marche: avecMarche
      ? {
          volatilite_moyenne: 15,
          pct_titres_baisse_moyen: 65,
          volume_relatif_moyen: 1.2,
          perf_banques_pct: -18,
          concentration_sectorielle: 22,
        }
      : undefined,
    trajectoire_base100: dds.map((dd, idx) => ({
      jour_seance: idx,
      date: dateSommet,
      base100: 100 + dd,
      drawdown_pct: dd,
      phase: 'baisse' as const,
    })),
  };
}

describe('Historical Crisis Engine — similarité historique', () => {
  it('attribue un score proche de 100 pour deux trajectoires identiques et reste borné [0, 100]', () => {
    const a = makeEpisode('2026-09-11', -18, 40, [0, -3, -6, -10, -14, -18]);
    const b = makeEpisode('2022-05-10', -18, 40, [0, -3, -6, -10, -14, -18]);
    const res = calculerSimilarite(a, b);
    expect(res.score).toBe(100);
    expect(res.couverture_variables_pct).toBe(100);
    expect(res.avertissement).toContain('ne constitue pas une prédiction');
  });

  it('renormalise proprement les poids lorsque les variables de marché sont absentes', () => {
    const a = makeEpisode('2026-09-11', -18, 40, [0, -4, -9, -14, -18], false);
    const b = makeEpisode('2008-06-01', -38, 180, [0, -2, -5, -12, -25], false);
    const res = calculerSimilarite(a, b);
    expect(res.composantes.variablesMarche).toBeNull();
    const sommePoids =
      res.poids_effectifs.euclidienne +
      res.poids_effectifs.correlation +
      res.poids_effectifs.formeDrawdown +
      res.poids_effectifs.variablesMarche;
    expect(sommePoids).toBeCloseTo(1, 2);
    expect(res.score).toBeGreaterThanOrEqual(0);
    expect(res.score).toBeLessThanOrEqual(100);
    expect(res.couverture_variables_pct).toBeCloseTo(80, 1);
  });

  it('classe l’épisode le plus proche devant un épisode très divergent', () => {
    const courant = makeEpisode('2026-09-11', -18, 45, [0, -4, -8, -12, -15, -18]);
    const proche = makeEpisode('2023-03-01', -17, 42, [0, -3.5, -7.5, -11.5, -15, -17]);
    const lointain = makeEpisode('2016-01-01', -45, 400, [0, -1, -2, -4, -6, -9]);

    const ranked = classerSimilarites(courant, [lointain, proche]);
    expect(ranked[0]!.episode.date_sommet).toBe('2023-03-01');
    expect(ranked[0]!.similarite.score).toBeGreaterThan(ranked[1]!.similarite.score);
  });
});
