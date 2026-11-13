import { describe, expect, it } from 'vitest';
import {
  OUTILS, accesOutil, rubriqueOutil, comptesAcces, ongletVoisin, apresTic, doitTourner, etatMethode,
  serieSansRupture, filtrerScreener, repartitionSignaux, grilleSaison, periodesIndice, perfSerie,
  fiscaliteParPays, barresDividendes, titreDividendes, barresSecteurs, titreSecteurs, campagnesPub, horizonsMesures,
  type LigneScreener,
} from './outilsPur';
import { BAREME } from '@/lib/tax/rates';
import { entreeParChemin } from '@/lib/navRegistre';
import type { Slide } from '@/lib/landing/slides';

describe('accès des outils', () => {
  it('lit le registre et la liste publique, ne suppose rien', () => {
    expect(accesOutil('/premium/paper-trading')).toBe('compte'); // gratuit depuis le 13/11
    expect(accesOutil('/assistant')).toBe('premium'); // premium: true au registre
    expect(accesOutil('/fiscalite')).toBe('libre');
    expect(accesOutil('/simulateur')).toBe('libre');
    expect(accesOutil('/analyse/combined-alpha')).toBe('premium'); // 0216
    expect(accesOutil('/screener')).toBe('premium'); // 0216
    expect(accesOutil('/dividendes')).toBe('compte');
    expect(accesOutil('/premium/inconnu')).toBe('premium'); // gardé par le middleware
  });
  it('quatorze outils, chacun déclaré au registre', () => {
    expect(OUTILS).toHaveLength(14);
    expect(new Set(OUTILS.map((o) => o.id)).size).toBe(14);
    for (const o of OUTILS) expect(entreeParChemin(o.route), o.route).toBeDefined();
    expect(rubriqueOutil('/screener')).toBe('Trouver une idée');
  });
  it('comptes par accès cohérents', () => {
    const c = comptesAcces();
    expect(c.libre + c.compte + c.premium).toBe(14);
    expect(c.premium).toBe(OUTILS.filter((o) => accesOutil(o.route) === 'premium').length);
  });
});

describe('explorateur : clavier et rotation', () => {
  it('flèches, Début et Fin bouclent', () => {
    expect(ongletVoisin(13, 'ArrowRight', 14)).toBe(0);
    expect(ongletVoisin(0, 'ArrowLeft', 14)).toBe(13);
    expect(ongletVoisin(5, 'Home', 14)).toBe(0);
    expect(ongletVoisin(5, 'End', 14)).toBe(13);
    expect(ongletVoisin(5, 'Enter', 14)).toBeNull();
  });
  it('deux tours puis arrêt', () => {
    let e = { index: 0, rotations: 0, arrete: false };
    let pas = 0;
    while (!e.arrete && pas < 100) { e = apresTic(e.index, e.rotations, 14); pas++; }
    expect(pas).toBe(28);
    expect(e.index).toBe(0);
  });
  it('ne tourne que visible, sans arrêt, hors mouvement réduit', () => {
    expect(doitTourner({ visible: true, arrete: false, calme: false })).toBe(true);
    expect(doitTourner({ visible: false, arrete: false, calme: false })).toBe(false);
    expect(doitTourner({ visible: true, arrete: true, calme: false })).toBe(false);
    expect(doitTourner({ visible: true, arrete: false, calme: true })).toBe(false);
  });
});

describe('méthode', () => {
  it('chaque étape à son tour, deux tours puis fin', () => {
    expect(etatMethode(0, 7, 1000).active).toBe(0);
    expect(etatMethode(2500, 7, 1000).active).toBe(2);
    expect(etatMethode(7500, 7, 1000).active).toBe(0); // second tour
    const fin = etatMethode(14000, 7, 1000);
    expect(fin.fini).toBe(true);
    expect(fin.active).toBeNull();
    expect(etatMethode(3500, 7, 1000).trait).toBeCloseTo(0.5);
  });
});

describe('garde-fous de série', () => {
  it('coupe après un fractionnement', () => {
    expect(serieSansRupture([40000, 41000, 4100, 4150])).toEqual([4100, 4150]);
    expect(serieSansRupture([100, 107, 100])).toEqual([100, 107, 100]);
    expect(serieSansRupture([100, 0, 101])).toEqual([100, 101]);
  });
});

describe('screener', () => {
  const l: LigneScreener[] = [
    { code: 'A', cours: 1, rsi: 40, rendement: 5, classe: 'A' },
    { code: 'B', cours: 1, rsi: 50, rendement: 2, classe: 'C' },
    { code: 'C', cours: 1, rsi: null, rendement: null, classe: null },
  ];
  it('filtres cumulés, une donnée absente ne passe pas', () => {
    expect(filtrerScreener(l, []).length).toBe(3);
    expect(filtrerScreener(l, ['div']).map((x) => x.code)).toEqual(['A']);
    expect(filtrerScreener(l, ['rsi']).map((x) => x.code)).toEqual(['A']);
    expect(filtrerScreener(l, ['liq', 'div', 'rsi']).map((x) => x.code)).toEqual(['A']);
  });
});

describe('signaux', () => {
  it('compte haussier, neutre, baissier ; ignore l’inconnu', () => {
    const codes = ['BUY', 'HOLD', 'HOLD', 'SELL', 'X', null];
    expect(repartitionSignaux(codes.map((signal) => ({ signal })))).toEqual({ haussier: 1, neutre: 2, baissier: 1 });
  });
});

describe('saisonnalité', () => {
  it('douze cases, médiane en %, mois sans donnée à null', () => {
    const g = grilleSaison([{ month: 1, medianReturn: 0.031, bullPct: 60, n: 10, verdict: 'indicatif' }]);
    expect(g).toHaveLength(12);
    expect(g[0].mediane).toBeCloseTo(3.1);
    expect(g[0].part).toBe(60);
    expect(g[1]).toMatchObject({ mediane: null, part: null, n: 0 });
  });
});

describe('indice', () => {
  const serie = Array.from({ length: 70 }, (_, i) => ({ d: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, v: 100 + i }));
  it('périodes limitées à la longueur de la série', () => {
    const p = periodesIndice(serie);
    expect(p.map((x) => x.libelle)).toEqual(['1 mois', '3 mois']);
    expect(p[0].variation).toBeCloseTo((169 / 149 - 1) * 100);
    expect(p[0].trace.startsWith('M')).toBe(true);
  });
  it('performance de bout en bout', () => {
    expect(perfSerie(serie)?.seances).toBe(70);
    expect(perfSerie(serie.slice(0, 1))).toBeNull();
  });
});

describe('fiscalité', () => {
  it('suit le barème, non confirmé reste non confirmé', () => {
    const f = fiscaliteParPays(100_000);
    expect(f).toHaveLength(Object.keys(BAREME).length);
    const ci = f.find((x) => x.pays === 'CI')!;
    expect(ci.taux).toBe(BAREME.CI.dividende_cote.taux);
    expect(ci.retenue! + ci.net!).toBe(100_000);
    const nonConfirmes = f.filter((x) => BAREME[x.pays].dividende_cote.taux == null);
    for (const x of nonConfirmes) expect(x).toMatchObject({ taux: null, retenue: null, net: null });
  });
});

describe('dividendes d’une valeur', () => {
  it('écarte les lignes douteuses, garde le max par exercice', () => {
    const b = barresDividendes([
      { exercice: 2021, montant: 140 }, { exercice: 2022, montant: 150 }, { exercice: 2022, montant: 149 },
      { exercice: 2023, montant: 2023 }, { exercice: 2024, montant: 0 }, { exercice: null, montant: 10 }, { exercice: 2025, montant: 174 },
    ]);
    expect(b).toEqual([{ exercice: 2021, montant: 140 }, { exercice: 2022, montant: 150 }, { exercice: 2025, montant: 174 }]);
    expect(titreDividendes(b)).toBe('2 hausses en 3 exercices.');
    expect(titreDividendes([{ exercice: 1, montant: 5 }, { exercice: 2, montant: 4 }])).toBe('Aucune hausse en 2 exercices.');
    expect(titreDividendes(b.slice(0, 1))).toBeNull();
  });
});

describe('secteurs', () => {
  it('triés, proportion au plus fort écart', () => {
    const b = barresSecteurs([{ secteur: 'X', variation_pct: -1, nb: 1 }, { secteur: 'Y', variation_pct: 2, nb: 1 }]);
    expect(b.map((x) => x.secteur)).toEqual(['Y', 'X']);
    expect(b[1].part).toBeCloseTo(0.5);
    expect(titreSecteurs(b)).toBe('Y en tête.');
    expect(titreSecteurs(barresSecteurs([{ secteur: 'X', variation_pct: -1, nb: 1 }]))).toBe('Aucun secteur en hausse.');
    expect(titreSecteurs([])).toBeNull();
  });
});

describe('encart publicitaire', () => {
  const s = (id: string, kind: Slide['kind'], imageUrl: string | null = 'x.jpg'): Slide => ({ id, kind, title: id, imageUrl });
  it('annonceurs seuls, sans doublon ni création sans image', () => {
    const c = campagnesPub([s('p', 'permanent', null), s('a', 'ad'), s('h', 'house')], [s('a', 'ad'), s('b', 'ad'), s('c', 'ad', null)]);
    expect(c.map((x) => x.id)).toEqual(['a', 'b']);
    expect(campagnesPub([], [])).toEqual([]);
  });
});

describe('événement', () => {
  it('ne garde que les horizons mesurés', () => {
    expect(horizonsMesures({ 'J+1': -1.2, 'J+3': null, 'J+5': 2 })).toEqual([{ horizon: 'J+1', variation: -1.2 }, { horizon: 'J+5', variation: 2 }]);
  });
});
