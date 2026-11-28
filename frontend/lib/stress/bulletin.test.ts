import { describe, expect, it } from 'vitest';
import {
  construireBulletin,
  choisirFacteurs,
  phraseAmpleur,
  reperesFenetre,
  REPONSES_THERMOMETRE,
  VERDICTS,
} from './bulletin';
import type { MapComposantesStress, RegimeStress, StressDailyRow } from './stressIndexTypes';

function composantes(over: Partial<Record<keyof MapComposantesStress, [number | null, number | null]>> = {}): MapComposantesStress {
  const base: Record<keyof MapComposantesStress, [number | null, number | null, number]> = {
    drawdown_composite: [53, -18.6, 0.25],
    largeur_baissiere: [68, 62.5, 0.2],
    volatilite_brvmv: [74, 17.6, 0.15],
    diffusion_sectorielle: [100, 100, 0.15],
    pression_volumes: [88, 77.2, 0.15],
    momentum_court_terme: [100, -15.5, 0.1],
  };
  const out = {} as MapComposantesStress;
  for (const cle of Object.keys(base) as (keyof MapComposantesStress)[]) {
    const [score, brute, poids] = base[cle];
    const o = over[cle];
    out[cle] = {
      score_0_100: o ? o[0] : score,
      valeur_brute: o ? o[1] : brute,
      unite_brute: '%',
      poids_nominal: poids,
      poids_effectif: poids,
    };
  }
  return out;
}

function ligne(date: string, indice: number, over: Partial<StressDailyRow> = {}): StressDailyRow {
  return {
    date_marche: date,
    stress_index: indice,
    regime: 'tension_extreme',
    couverture_composantes_pct: 100,
    nb_composantes_actives: 6,
    composantes: composantes(),
    variation_5j_pts: 11.1,
    variation_20j_pts: 29,
    variation_60j_pts: 56.3,
    observables_marche: {
      brvmc_cloture: 453.57,
      drawdown_brvmc_pct: -18.35,
      largeur_hausses_5j_pct: 19.6,
      ecart_brvmc_mm20_pct: -9.9,
      variation_brvmv_20j_pts: 5.37,
      ratio_volume_60j: 0.26,
    },
    ...over,
  };
}

const HIST = [ligne('2026-09-10', 18), ligne('2026-09-11', 20), ligne('2026-11-26', 76.1), ligne('2026-11-27', 76.2)];

describe('verdict et réponse', () => {
  const cas: [RegimeStress, number][] = [
    ['faible_tension', 12],
    ['tension_moderee', 30],
    ['tension_elevee', 60],
    ['tension_extreme', 80],
  ];
  it.each(cas)('régime %s', (regime, indice) => {
    const b = construireBulletin({ actuel: ligne('2026-11-27', indice, { regime }), historique: [] });
    expect(b.verdict).toBe(VERDICTS[regime]);
    expect(b.reponse).toBe(REPONSES_THERMOMETRE[regime]);
    expect(b.note).toBe(Math.round(indice));
  });

  it('régime inconnu : recalculé depuis l’indice', () => {
    const b = construireBulletin({ actuel: ligne('2026-11-27', 55, { regime: 'autre' as RegimeStress }), historique: [] });
    expect(b.regime).toBe('tension_elevee');
  });
});

describe('phrases', () => {
  it('trajectoire depuis le plus haut du Composite, ampleur datée, étendue', () => {
    const b = construireBulletin({
      actuel: HIST[3],
      historique: HIST,
      composite: { drawdownPct: -18.39, dateSommet: '2026-09-11' },
    });
    expect(b.phrases).toEqual([
      'Depuis le 11 sept. 2026, la tension est passée de 20 à 76.',
      'Le BRVM Composite est 18\u00a0% sous son plus haut du 11 sept. 2026.',
      'La baisse touche tous les secteurs.',
    ]);
  });

  it('sans plus haut connu : trajectoire sur 20 séances, ampleur sans date', () => {
    const b = construireBulletin({ actuel: HIST[3], historique: HIST });
    expect(b.phrases[0]).toBe('En 20 séances, la tension a augmenté de 29 points.');
    expect(b.phrases[1]).toBe('Le BRVM Composite est 18\u00a0% sous son plus haut.');
  });

  it('variation faible : tension stable ; variation absente : phrase omise', () => {
    expect(construireBulletin({ actuel: ligne('2026-11-27', 40, { variation_20j_pts: 1.4 }), historique: [] }).phrases[0]).toBe(
      'En 20 séances, la tension est restée stable.',
    );
    const sans = construireBulletin({ actuel: ligne('2026-11-27', 40, { variation_20j_pts: null }), historique: [] });
    expect(sans.phrases.some((p) => p.startsWith('En 20 séances'))).toBe(false);
  });

  it('Composite à son plus haut', () => {
    expect(phraseAmpleur(ligne('2026-11-27', 10), { drawdownPct: -0.2, dateSommet: '2026-11-27' })).toBe(
      'Le BRVM Composite est à son plus haut.',
    );
  });

  it.each([
    [100, 'La baisse touche tous les secteurs.'],
    [75, 'La baisse touche la plupart des secteurs.'],
    [45, 'Une partie des secteurs recule.'],
    [10, 'Peu de secteurs reculent.'],
  ])('étendue : %s %%', (valeur, attendu) => {
    const b = construireBulletin({
      actuel: ligne('2026-11-27', 50, { composantes: composantes({ diffusion_sectorielle: [50, valeur] }) }),
      historique: [],
    });
    expect(b.phrases).toContain(attendu);
  });

  it('étendue indisponible : phrase omise', () => {
    const b = construireBulletin({
      actuel: ligne('2026-11-27', 50, { composantes: composantes({ diffusion_sectorielle: [null, null] }) }),
      historique: [],
    });
    expect(b.phrases.some((p) => /secteur/.test(p))).toBe(false);
  });
});

describe('facteurs', () => {
  it('les trois plus fortes contributions, avec une mesure chiffrée', () => {
    const f = choisirFacteurs(ligne('2026-11-27', 76));
    // 100×0,15 = 15 ; 68×0,20 = 13,6 ; 53×0,25 = 13,25 (devant 88×0,15 = 13,2).
    expect(f.map((x) => x.cle)).toEqual(['diffusion_sectorielle', 'largeur_baissiere', 'drawdown_composite']);
    expect(f[1].mesure).toBe('6 titres sur 10 en baisse (5 séances)');
    expect(f[0].titre).toBe('Secteurs en baisse');
  });

  it('composantes indisponibles ignorées ; égalité départagée par le poids nominal', () => {
    const f = choisirFacteurs(
      ligne('2026-11-27', 50, {
        composantes: composantes({
          diffusion_sectorielle: [null, null],
          largeur_baissiere: [50, 50],
          drawdown_composite: [40, -10],
          pression_volumes: [10, 10],
          volatilite_brvmv: [10, 10],
          momentum_court_terme: [100, -5],
        }),
      }),
    );
    // largeur 50×0,20 = 10 ; drawdown 40×0,25 = 10 ; momentum 100×0,10 = 10 → poids nominal : drawdown, largeur, momentum.
    expect(f.map((x) => x.cle)).toEqual(['drawdown_composite', 'largeur_baissiere', 'momentum_court_terme']);
  });
});

describe('repères du graphique', () => {
  const serie = [
    { date: 'a', valeur: 30 },
    { date: 'b', valeur: 12 },
    { date: 'c', valeur: 55 },
    { date: 'd', valeur: 40 },
    { date: 'e', valeur: 78 },
    { date: 'f', valeur: 76 },
  ];

  it('dernier franchissement de 75, point le plus bas, plus haut du Composite', () => {
    expect(reperesFenetre(serie, 'c')).toEqual([
      { date: 'e', valeur: 78, libelle: 'Seuil 75 franchi' },
      { date: 'b', valeur: 12, libelle: 'Point le plus calme' },
      { date: 'c', valeur: 55, libelle: 'Plus haut du Composite' },
    ]);
  });

  it('sans franchissement de 75 : seuil 50 ; au plus trois repères ; dates uniques', () => {
    const r = reperesFenetre(serie.slice(0, 4), 'b');
    expect(r).toEqual([
      { date: 'c', valeur: 55, libelle: 'Seuil 50 franchi' },
      { date: 'b', valeur: 12, libelle: 'Point le plus calme' },
    ]);
    expect(reperesFenetre([{ date: 'x', valeur: 1 }], null)).toEqual([]);
  });
});
