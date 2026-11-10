import { describe, it, expect } from 'vitest';
import { classerPublication, suspensionUtile, dedoublonner } from '../src/saisonnalite/evenements.js';
import { rendementsQuotidiens, marcheQuotidien, cheminsEvenements, agreger, retourCoupon } from '../src/saisonnalite/fenetres.js';
import type { Serie } from '../src/conseiller/types.js';

describe('classerPublication (titres réels)', () => {
  it.each([
    ['SOGB CI : Etats financiers SYSCOHADA - Exercice 2025', 'etats_financiers', 'comptes_annuels'],
    ["SICOR CI : Rapport d'activités annuel et Etats Financiers - Exercice 2024", 'etats_financiers', 'comptes_annuels'],
    ['NEI-CEDA CI : Etats financiers provisoires - Exercice 2024 certifiés par les CAC', 'etats_financiers', 'comptes_annuels'],
    ["SOGB CI : Rapport d'activités - 1er semestre 2026", 'rapport', 'comptes_semestriels'],
    ['Etats financiers semestriels au 30 juin 2025 - ORANGE CI', 'etats_financiers', 'comptes_semestriels'],
    ['Avis de convocation - Assemblée Générale Ordinaire - ETI TG', 'ag', 'convocation_ag'],
    ['Annulation AGO - ETI TG', 'ag', null],
    ['Formulaire de vote par correspondance - Assemblée Générale Mixte - AFRICA GLOBAL LOGISTICS', 'ag', null],
    ["SOGB CI : Rapport d'activités - 3e trimestre 2026", 'rapport', null],
    ['Avertissement sur résultats 2019 - SAFCA CI', 'autre', 'avertissement'],
    ['Paiement de dividendes - SONATEL', 'autre', null],
  ])('%s → %s', (libelle, type, attendu) => {
    expect(classerPublication(libelle, type)).toBe(attendu);
  });
});

describe('suspensionUtile', () => {
  it('écarte les avis de reprise', () => {
    expect(suspensionUtile('SOGB: Avis suite à la suspension de cotation')).toBe(true);
    expect(suspensionUtile('SOGB: Avis de reprise de cotation')).toBe(false);
  });
});

describe('dedoublonner', () => {
  it('garde la première date d’un même événement publié plusieurs fois en 30 jours', () => {
    const r = dedoublonner([
      { type: 'comptes_annuels', date: '2025-04-30' },
      { type: 'comptes_annuels', date: '2025-06-16' },
      { type: 'comptes_annuels', date: '2025-04-10' },
      { type: 'convocation_ag', date: '2025-04-12' },
    ]);
    expect(r).toEqual([
      { type: 'comptes_annuels', date: '2025-04-10' },
      { type: 'convocation_ag', date: '2025-04-12' },
      { type: 'comptes_annuels', date: '2025-06-16' },
    ]);
  });
});

/** Série de n séances consécutives (dates fictives triées), cours donnés. */
function serie(cours: number[]): Serie {
  const s: Serie = { dates: [], cours: [], volumes: [], valeurs: [], variations: [], pos: new Map() };
  cours.forEach((c, i) => {
    const d = `2025-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`;
    s.pos.set(d, i); s.dates.push(d); s.cours.push(c); s.volumes.push(1); s.valeurs.push(c); s.variations.push(null);
  });
  return s;
}

describe('rendementsQuotidiens', () => {
  it('réintègre le coupon le jour du détachement', () => {
    const s = serie([100, 100, 94]);
    const r = rendementsQuotidiens(s, [{ code: 'X', exercice: 2024, montant: 6, disponibleLe: '', exDate: s.dates[2]! }]);
    expect(r[0]).toBeNull();
    expect(r[1]).toBeCloseTo(0);
    expect(r[2]).toBeCloseTo(0);
  });
});

describe('cheminsEvenements et agreger', () => {
  const n = 80;
  // Valeur : +1 % le jour de l'événement (rang 0), sinon plate. Marché plat.
  const s = serie(Array.from({ length: n }, (_, i) => (i >= 30 ? 101 : 100)));
  const r = rendementsQuotidiens(s, []);
  const marche = new Map(s.dates.map((d) => [d, 0]));

  it('parcours de l’écart au marché de −20 à +40, base la veille de la fenêtre', () => {
    const ch = cheminsEvenements({ serie: s, r, marche, dates: [s.dates[30]!], ruptures: new Set() });
    expect(ch).toHaveLength(1);
    expect(ch[0]).toHaveLength(61);
    expect(ch[0]![19]).toBeCloseTo(0); // rang −1
    expect(ch[0]![20]).toBeCloseTo(0.01); // rang 0
    expect(ch[0]![60]).toBeCloseTo(0.01); // rang +40
  });

  it('écarte une fenêtre incomplète ou traversée par une rupture', () => {
    expect(cheminsEvenements({ serie: s, r, marche, dates: [s.dates[5]!], ruptures: new Set() })).toHaveLength(0);
    expect(cheminsEvenements({ serie: s, r, marche, dates: [s.dates[30]!], ruptures: new Set([s.dates[35]!]) })).toHaveLength(0);
  });

  it('agrège par rang : moyenne, médiane, part positive, effectif', () => {
    const a = agreger([[0.01, 0.02], [0.03, -0.02], [0.02, 0.0]], 0);
    expect(a[0]).toMatchObject({ rang: 0, n: 3 });
    expect(a[0]!.moyenne).toBeCloseTo(0.02);
    expect(a[0]!.mediane).toBeCloseTo(0.02);
    expect(a[0]!.part_positifs).toBeCloseTo(1);
    expect(a[1]!.part_positifs).toBeCloseTo(1 / 3);
  });
});

describe('marcheQuotidien', () => {
  it('moyenne équipondérée écrêtée à ±30 %', () => {
    const d = ['2025-01-01', '2025-01-02'];
    const m = marcheQuotidien([
      { dates: d, r: [null, 0.5] },
      { dates: d, r: [null, 0.1] },
    ]);
    expect(m.get('2025-01-02')).toBeCloseTo(0.2);
    expect(m.has('2025-01-01')).toBe(false);
  });
});

describe('retourCoupon', () => {
  it('part des détachements revenus au cours de la veille dans l’horizon', () => {
    // Veille 100, détachement à 94, retour à 100 à la 10e séance après.
    const cours = Array.from({ length: 300 }, (_, i) => (i < 50 ? 100 : i < 60 ? 94 : 100));
    const s = serie(cours);
    const r = retourCoupon(s, [s.dates[50]!], [5, 20]);
    expect(r).toEqual([{ horizon: 5, revenus: 0, n: 1 }, { horizon: 20, revenus: 1, n: 1 }]);
  });
});
