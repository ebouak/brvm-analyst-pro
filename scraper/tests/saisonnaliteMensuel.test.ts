import { describe, it, expect } from 'vitest';
import { faitsMensuels, rdtMarche, anneesDifficiles, type FaitMensuel } from '../src/saisonnalite/mensuel.js';
import type { ComptesAnnuels, Dividende, Serie } from '../src/conseiller/types.js';

/** Série à partir de [date, cours, volume]. */
function serie(lignes: [string, number, number][]): Serie {
  const s: Serie = { dates: [], cours: [], volumes: [], valeurs: [], variations: [], pos: new Map() };
  for (const [d, c, v] of lignes) {
    s.pos.set(d, s.dates.length);
    s.dates.push(d);
    s.cours.push(c);
    s.volumes.push(v);
    s.valeurs.push(c * v);
    s.variations.push(null);
  }
  return s;
}
const cal = (s: Serie) => s.dates;
const ligne = (fs: FaitMensuel[], annee: number, mois: number) => fs.find((f) => f.annee === annee && f.mois === mois)!;

describe('faitsMensuels', () => {
  const base: [string, number, number][] = [
    ['2025-01-30', 100, 10], ['2025-01-31', 100, 10],
    ['2025-02-14', 105, 10], ['2025-02-28', 110, 10],
    ['2025-03-14', 110, 5], ['2025-03-31', 121, 5],
  ];

  it('rendement prix et total sur un mois sans événement', () => {
    const s = serie(base);
    const fs = faitsMensuels({ code: 'X', serie: s, calendrier: cal(s), dividendes: [], ruptures: new Set(), anneesDifficiles: new Set(), asOf: '2025-04-15' });
    const fev = ligne(fs, 2025, 2);
    expect(fev.rdt_prix).toBeCloseTo(0.1);
    expect(fev.rdt_total).toBeCloseTo(0.1);
    expect(fev.exclu).toBeNull();
    expect(fev.complet).toBe(true);
    expect(fev.seances_cotees).toBe(2);
    expect(fev.valeur_echangee).toBe(2150);
    // Le premier mois n'a pas de mois précédent : pas de ligne.
    expect(fs.find((f) => f.mois === 1)).toBeUndefined();
  });

  it('le mois de asOf est marqué incomplet', () => {
    const s = serie([...base, ['2025-04-07', 130, 3]]);
    const fs = faitsMensuels({ code: 'X', serie: s, calendrier: cal(s), dividendes: [], ruptures: new Set(), anneesDifficiles: new Set(), asOf: '2025-04-10' });
    expect(ligne(fs, 2025, 4).complet).toBe(false);
    expect(ligne(fs, 2025, 3).complet).toBe(true);
  });

  it('mois sans échange puis mois de reprise : tous deux exclus, rendement nul', () => {
    const s = serie([
      ['2025-01-31', 100, 10],
      ['2025-02-28', 100, 0], // cours recopié, aucun échange
      ['2025-03-31', 130, 4],
      ['2025-04-30', 143, 4],
    ]);
    const fs = faitsMensuels({ code: 'X', serie: s, calendrier: cal(s), dividendes: [], ruptures: new Set(), anneesDifficiles: new Set(), asOf: '2025-06-01' });
    expect(ligne(fs, 2025, 2)).toMatchObject({ exclu: 'sans_echange', rdt_prix: null, rdt_total: null, seances_cotees: 0 });
    expect(ligne(fs, 2025, 3)).toMatchObject({ exclu: 'reprise', rdt_prix: null, rdt_total: null });
    expect(ligne(fs, 2025, 4).rdt_prix).toBeCloseTo(0.1);
  });

  it('un mois absent de la série compte comme sans échange pour le mois suivant', () => {
    const s = serie([['2025-01-31', 100, 10], ['2025-03-31', 120, 10]]);
    const fs = faitsMensuels({ code: 'X', serie: s, calendrier: ['2025-01-31', '2025-02-28', '2025-03-31'], dividendes: [], ruptures: new Set(), anneesDifficiles: new Set(), asOf: '2025-06-01' });
    expect(ligne(fs, 2025, 3).exclu).toBe('reprise');
  });

  it('détachement : le total réintègre le coupon, le prix montre la fausse baisse', () => {
    const s = serie([
      ['2025-04-30', 1000, 10],
      ['2025-05-15', 1000, 10], ['2025-05-16', 940, 10], ['2025-05-30', 950, 10],
    ]);
    const div: Dividende[] = [{ code: 'X', exercice: 2024, montant: 63, disponibleLe: '2025-07-31', exDate: '2025-05-16' }];
    const fs = faitsMensuels({ code: 'X', serie: s, calendrier: cal(s), dividendes: div, ruptures: new Set(), anneesDifficiles: new Set(), asOf: '2025-06-10' });
    const mai = ligne(fs, 2025, 5);
    expect(mai.rdt_prix).toBeCloseTo(-0.05);
    expect(mai.rdt_total).toBeCloseTo(0.013);
    expect(mai.dividende).toBe(63);
    expect(mai.evenements).toEqual([{ type: 'detachement', date: '2025-05-16' }]);
  });

  it('les autres événements sont rangés dans leur mois, triés par date', () => {
    const s = serie(base);
    const fs = faitsMensuels({
      code: 'X', serie: s, calendrier: cal(s), dividendes: [], ruptures: new Set(), anneesDifficiles: new Set(), asOf: '2025-06-01',
      autres: [{ type: 'convocation_ag', date: '2025-03-20' }, { type: 'comptes_annuels', date: '2025-03-02' }],
    });
    expect(ligne(fs, 2025, 3).evenements).toEqual([
      { type: 'comptes_annuels', date: '2025-03-02' },
      { type: 'convocation_ag', date: '2025-03-20' },
    ]);
    expect(ligne(fs, 2025, 2).evenements).toEqual([]);
  });

  it('rupture non expliquée dans le mois : exclu « saut », aucun rendement', () => {
    const s = serie([['2025-01-31', 100, 10], ['2025-02-10', 40, 10], ['2025-02-28', 42, 10]]);
    const fs = faitsMensuels({ code: 'X', serie: s, calendrier: cal(s), dividendes: [], ruptures: new Set(['2025-02-10']), anneesDifficiles: new Set(), asOf: '2025-06-01' });
    expect(ligne(fs, 2025, 2)).toMatchObject({ exclu: 'saut', rdt_prix: null, rdt_total: null });
  });

  it('année de difficulté reportée sur chaque mois de l’année', () => {
    const s = serie(base);
    const fs = faitsMensuels({ code: 'X', serie: s, calendrier: cal(s), dividendes: [], ruptures: new Set(), anneesDifficiles: new Set([2025]), asOf: '2025-06-01' });
    expect(fs.every((f) => f.difficulte)).toBe(true);
  });
});

describe('anneesDifficiles', () => {
  const comptes = (ex: number, rn: number | null): ComptesAnnuels => ({ code: 'X', exercice: ex, resultatNet: rn, capitauxPropres: null, actions: null, disponibleLe: `${ex + 1}-04-30` });
  const div = (ex: number): Dividende => ({ code: 'X', exercice: ex, montant: 10, disponibleLe: `${ex + 1}-07-31`, exDate: `${ex + 1}-06-01` });

  it('résultat net négatif de l’exercice', () => {
    expect([...anneesDifficiles([comptes(2020, 5), comptes(2021, -3)], [])]).toEqual([2021]);
  });

  it('dividende supprimé après une année payée, sur une période couverte par la table', () => {
    // Payé pour 2019, rien pour 2020 (détachement attendu en 2021), payé à nouveau pour 2021.
    const r = anneesDifficiles([comptes(2020, 5)], [div(2019), div(2021)]);
    expect([...r]).toEqual([2021]);
  });

  it('suspension et avertissement marquent leur année', () => {
    const r = anneesDifficiles([], [], [
      { type: 'suspension', date: '2011-05-26' },
      { type: 'avertissement', date: '2019-09-02' },
      { type: 'convocation_ag', date: '2020-04-02' },
    ]);
    expect([...r].sort()).toEqual([2011, 2019]);
  });

  it('pas de suppression déclarée au-delà du dernier exercice connu', () => {
    // Payé pour 2023, rien pour 2024 : la table ne couvre pas encore 2024.
    expect([...anneesDifficiles([], [div(2022), div(2023)])]).toEqual([]);
  });
});

describe('rdtMarche', () => {
  const f = (code: string, rdt: number | null, exclu: FaitMensuel['exclu'] = null): FaitMensuel => ({
    code, annee: 2025, mois: 2, rdt_prix: rdt, rdt_total: rdt, rdt_marche: null, dividende: null,
    seances_cotees: 5, seances_marche: 20, valeur_echangee: 0, exclu, evenements: [], difficulte: false, complet: true,
  });
  it('moyenne équipondérée écrêtée à ±30 %, exclus écartés', () => {
    const m = rdtMarche([f('A', 0.5), f('B', 0.1), f('C', 0.9, 'reprise'), f('D', null)]);
    expect(m.get('2025-02')).toBeCloseTo(0.2);
  });
});
