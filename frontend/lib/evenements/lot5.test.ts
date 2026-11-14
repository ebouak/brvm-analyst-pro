import { describe, expect, it } from 'vitest';
import { affichageReaction, constatEvenement, debutPeriode, lireFiltrePeriode, medianeReactions } from './reaction';
import { souffleMarche } from './seance';
import { fenetreCourbe, tableauHorizons } from './courbe';
import {
  bilanSaison, periodeDeSaison, periodesDisponibles, titreSaison, variationPct, variationsComptes,
} from './saison';
import type { EvenementRegroupe } from './regroupement';
import { assertNoCausalClaim } from '@/lib/hebdo/narrative';

const MOTS_INTERDITS = /\b(achat|vente|acheter|vendre|opportunit|objectif de cours|trading)/i;

describe('affichageReaction', () => {
  it('en cours prime sur toute valeur', () => {
    expect(affichageReaction({ ecartIndicePct: 3, enCours: true }).genre).toBe('en_cours');
  });
  it('non mesurable : tiret, jamais zéro', () => {
    expect(affichageReaction({ ecartIndicePct: null, enCours: false })).toEqual({ genre: 'indisponible', texte: '—' });
    expect(affichageReaction(undefined).genre).toBe('indisponible');
  });
  it('mesurée : signe et sens', () => {
    const a = affichageReaction({ ecartIndicePct: -2.5, enCours: false });
    expect(a.genre === 'mesuree' && a.sens).toBe('baisse');
    expect(a.texte).toContain('2,50');
    const b = affichageReaction({ ecartIndicePct: 0, enCours: false });
    expect(b.genre === 'mesuree' && b.sens).toBe('neutre');
  });
});

describe('medianeReactions', () => {
  it('null sous 3 mesures closes', () => {
    expect(medianeReactions([{ ecartIndicePct: 1, enCours: false }, { ecartIndicePct: 2, enCours: false }]).mediane).toBeNull();
  });
  it('ignore les réactions en cours et non mesurées', () => {
    const r = medianeReactions([
      { ecartIndicePct: 1, enCours: false }, { ecartIndicePct: 5, enCours: false }, { ecartIndicePct: 3, enCours: false },
      { ecartIndicePct: 99, enCours: true }, { ecartIndicePct: null, enCours: false },
    ]);
    expect(r).toEqual({ mediane: 3, nMesurees: 3 });
  });
  it('médiane paire', () => {
    expect(medianeReactions([1, 2, 3, 4].map((v) => ({ ecartIndicePct: v, enCours: false }))).mediane).toBe(2.5);
  });
});

describe('filtres de période', () => {
  it('lecture tolérante', () => {
    expect(lireFiltrePeriode(undefined)).toBe('90j');
    expect(lireFiltrePeriode('x')).toBe('90j');
    expect(lireFiltrePeriode('tout')).toBe('tout');
  });
  it('bornes', () => {
    expect(debutPeriode('2026-11-14', '30j')).toBe('2026-10-15');
    expect(debutPeriode('2026-11-14', 'tout')).toBeNull();
  });
});

describe('constatEvenement', () => {
  const base = { code: 'SNTS', typeLibelle: 'Résultats', periodeLibelle: '3e trimestre 2026', horizon: 5, seancesObservees: 5 };
  it('mesuré, sans cause ni conseil', () => {
    const t = constatEvenement({ ...base, ecartIndicePct: 2.1, enCours: false });
    expect(t).toContain('SNTS');
    expect(t).toContain('au-dessus de l’indice');
    expect(assertNoCausalClaim(t)).toBe(true);
    expect(t).not.toMatch(MOTS_INTERDITS);
  });
  it('en cours : accord du pluriel', () => {
    expect(constatEvenement({ ...base, ecartIndicePct: null, enCours: true, seancesObservees: 2 })).toContain('2 séances sur 5 observées');
    expect(constatEvenement({ ...base, ecartIndicePct: null, enCours: true, seancesObservees: 1 })).toContain('1 séance sur 5 observée.');
  });
  it('non mesurable : le dit', () => {
    expect(constatEvenement({ ...base, ecartIndicePct: null, enCours: false })).toContain('non mesurable');
  });
});

describe('souffleMarche', () => {
  it('compte hausses, baisses, stables ; ignore les absents', () => {
    expect(souffleMarche([1, -1, 0, null, undefined, 2])).toEqual({ hausses: 2, baisses: 1, stables: 1, total: 4 });
    expect(souffleMarche([])).toEqual({ hausses: 0, baisses: 0, stables: 0, total: 0 });
  });
});

const jour = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
const serie = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => ({ date: jour(i), close: f(i) }));

describe('fenetreCourbe', () => {
  const titre = serie(40, (i) => 100 + i);
  const indice = serie(40, () => 200);
  it('base 100 en J0, fenêtre J-10..J+10', () => {
    const c = fenetreCourbe(titre, indice, jour(20))!;
    expect(c.points).toHaveLength(21);
    expect(c.points[0]!.decalage).toBe(-10);
    const j0 = c.points.find((p) => p.decalage === 0)!;
    expect(j0.titre).toBe(100);
    expect(j0.indice).toBe(100);
    expect(c.seancesApres).toBe(10);
  });
  it('fenêtre tronquée : décalages disponibles seulement', () => {
    const c = fenetreCourbe(titre, indice, jour(37))!;
    expect(c.seancesApres).toBe(2);
    expect(c.points[c.points.length - 1]!.decalage).toBe(2);
  });
  it('J0 introuvable : null', () => {
    expect(fenetreCourbe(titre, indice, '2030-01-01')).toBeNull();
  });
  it('indice manquant : null sur ce point, jamais zéro', () => {
    const c = fenetreCourbe(titre, indice.filter((d) => d.date !== jour(22)), jour(20))!;
    expect(c.points.find((p) => p.decalage === 2)!.indice).toBeNull();
  });
});

describe('tableauHorizons', () => {
  it('horizon non atteint : null', () => {
    const t = serie(25, (i) => 100 + i);
    const ind = serie(25, () => 100);
    const lignes = tableauHorizons(t, ind, jour(20));
    expect(lignes.map((l) => l.horizon)).toEqual([1, 3, 5, 10]);
    expect(lignes[0]!.titre).not.toBeNull();
    expect(lignes[3]!.titre).toBeNull();
    expect(lignes[3]!.ecart).toBeNull();
  });
});

const ev = (id: string, code: string, date: string, periode: string, type = 'resultats'): EvenementRegroupe => ({
  id, date, titre: `Résultats ${periode}`, type, code, periode, pieces: [],
});

describe('saison des résultats', () => {
  const evts = [
    ev('1', 'SNTS', '2026-11-05', 'T3-2026'), ev('2', 'ORAC', '2026-11-06', 'T3-2026'), ev('3', 'BOAB', '2026-11-07', 'T3-2026'),
    ev('4', 'SGBC', '2026-04-10', 'A-2025'), ev('5', 'XXXX', '2026-11-01', 'T3-2026'),
    ev('6', 'SNTS', '2026-11-10', 'T3-2026', 'dividende'),
  ];
  it('période en cours = la plus fournie récemment', () => {
    expect(periodeDeSaison(evts, '2026-11-14')).toBe('T3-2026');
  });
  it('aucune publication récente : null', () => {
    expect(periodeDeSaison(evts, '2027-06-01')).toBeNull();
  });
  it('périodes disponibles, la plus récente d’abord', () => {
    expect(periodesDisponibles(evts)).toEqual(['T3-2026', 'A-2025']);
  });
  it('bilan : N sur M actifs, sociétés inactives ignorées', () => {
    const b = bilanSaison(['SNTS', 'ORAC', 'BOAB', 'SGBC'], evts, 'T3-2026');
    expect(b.nPublies).toBe(3);
    expect(b.nActifs).toBe(4);
    expect(b.nonPublies).toEqual(['SGBC']);
    expect(b.publies.map((p) => p.code)).not.toContain('XXXX');
  });
  it('première publication de la période par société', () => {
    const b = bilanSaison(['SNTS'], [ev('a', 'SNTS', '2026-11-09', 'T3-2026'), ev('b', 'SNTS', '2026-11-05', 'T3-2026')], 'T3-2026');
    expect(b.publies[0]!.date).toBe('2026-11-05');
  });
  it('titre : accords et élisions', () => {
    expect(titreSaison({ periode: 'T3-2026', nPublies: 31, nActifs: 48 })).toBe('31 sociétés sur 48 ont publié leurs résultats du 3e trimestre 2026');
    expect(titreSaison({ periode: 'A-2025', nPublies: 1, nActifs: 48 })).toBe('1 société sur 48 a publié ses résultats de l’exercice 2025');
    expect(titreSaison({ periode: '9M-2026', nPublies: 2, nActifs: 48 })).toContain('des 9 mois 2026');
    expect(titreSaison({ periode: 'T3-2026', nPublies: 31, nActifs: 48 })).not.toMatch(MOTS_INTERDITS);
  });
});

describe('variations de comptes', () => {
  it('variation simple, base non positive : null', () => {
    expect(variationPct(110, 100)).toBeCloseTo(10);
    expect(variationPct(10, -5)).toBeNull();
    expect(variationPct(10, 0)).toBeNull();
    expect(variationPct(null, 5)).toBeNull();
  });
  const lignes = [
    { periode: '2025', revenu_total: 120, resultat_net: 30 },
    { periode: '2024', revenu_total: 100, resultat_net: 20 },
  ];
  it('exercice annuel extrait', () => {
    const v = variationsComptes('A-2025', lignes);
    expect(v.extrait).toBe(true);
    expect(v.chiffreAffaires).toBeCloseTo(20);
    expect(v.resultatNet).toBeCloseTo(50);
  });
  it('trimestre ou exercice absent : non extrait', () => {
    expect(variationsComptes('T3-2026', lignes).extrait).toBe(false);
    expect(variationsComptes('A-2026', lignes).extrait).toBe(false);
  });
});
