import { describe, it, expect } from 'vitest';
import { derivePortfolio, type PricePoint, type RawPosition } from '@/lib/portfolio/derive';
import { calculerRecap } from './calcul';

/** Portefeuille de synthèse (valeurs inventées pour le test, pas de la production). */
const positions: RawPosition[] = [
  { code: 'AAAA', quantite: 10, prix_entree: 1000, date_entree: '2026-01-02', secteur: 'Banques' },
  { code: 'BBBB', quantite: 100, prix_entree: 50, date_entree: '2026-01-02', secteur: 'Télécoms' },
  { code: 'CCCC', quantite: 4, prix_entree: 2500, date_entree: '2026-01-02', secteur: 'Banques' },
  { code: 'LIQUIDITES', quantite: 1, prix_entree: 5000, date_entree: null, secteur: 'Liquidités', is_liquidites: true },
];
const historique = new Map<string, PricePoint[]>([
  ['AAAA', [{ date: '2026-10-22', cours: 1000 }, { date: '2026-10-23', cours: 1100 }]],
  ['BBBB', [{ date: '2026-10-22', cours: 50 }, { date: '2026-10-23', cours: 40 }]],
  ['CCCC', [{ date: '2026-10-22', cours: 2500 }, { date: '2026-10-23', cours: 2500 }]],
]);
const etat = derivePortfolio(positions, historique, '2026-10-24');

const base = {
  etat,
  seance: '2026-10-23',
  // AAAA +10 % (1000 → 1100), BBBB −20 % (50 → 40), CCCC stable.
  variationJour: { AAAA: 10, BBBB: -20, CCCC: 0 },
  dividendes: [
    { code: 'CCCC', exDate: '2026-11-20', montant: 150 },
    { code: 'AAAA', exDate: '2026-11-05', montant: 60 },
  ],
  alertesDuJour: 2,
};

describe('calculerRecap', () => {
  it('valeur, investi et plus-value repris de derivePortfolio (mêmes chiffres que /portefeuille)', () => {
    const r = calculerRecap(base);
    expect(r.valeur).toBe(etat.currentValue);
    expect(r.investi).toBe(etat.investedCapital);
    expect(r.pnl).toBe(etat.latentPnl);
    expect(r.seanceFr).toBe('23 octobre 2026');
    expect(r.vide).toBe(false);
  });

  it('variation du jour : somme des écarts de cours × quantité, en pourcentage de la valeur de la veille', () => {
    const r = calculerRecap(base);
    // AAAA : 10 × (1100 − 1000) = +1 000 ; BBBB : 100 × (40 − 50) = −1 000 ; CCCC : 0.
    expect(r.varJour?.montant).toBeCloseTo(0, 6);
    expect(r.varJour?.pct).toBeCloseTo(0, 6);
  });

  it('meilleures et moins bonnes lignes du jour, sans les stables ni les liquidités', () => {
    const r = calculerRecap(base);
    expect(r.meilleures.map((l) => l.code)).toEqual(['AAAA']);
    expect(r.moinsBonnes.map((l) => l.code)).toEqual(['BBBB']);
    expect(r.meilleures[0].variation).toBe(10);
  });

  it('secteurs par poids décroissant, dividendes à venir triés par date', () => {
    const r = calculerRecap(base);
    expect(r.secteurs[0].poids).toBeGreaterThanOrEqual(r.secteurs[r.secteurs.length - 1].poids);
    expect(r.dividendes.map((d) => d.code)).toEqual(['AAAA', 'CCCC']);
    expect(r.dividendes[0].exDateFr).toBe('05/11/2026');
    expect(r.alertesDuJour).toBe(2);
  });

  it('aucune valeur cotée ce jour : variation du jour inconnue (null), jamais zéro', () => {
    const r = calculerRecap({ ...base, variationJour: {} });
    expect(r.varJour).toBeNull();
    expect(r.meilleures).toEqual([]);
  });

  it('portefeuille vide : drapeau vide, aucun chiffre', () => {
    const r = calculerRecap({ ...base, etat: derivePortfolio([], new Map(), '2026-10-24') });
    expect(r.vide).toBe(true);
    expect(r.lignes).toBe(0);
  });

  it('au plus 3 meilleures, 3 moins bonnes, 3 dividendes, 4 secteurs + « Autres »', () => {
    const beaucoup: RawPosition[] = Array.from({ length: 8 }, (_, i) => ({
      code: `C${i}`, quantite: 1, prix_entree: 100, date_entree: null, secteur: `S${i}`,
    }));
    const h = new Map(beaucoup.map((p) => [p.code, [{ date: '2026-10-23', cours: 100 + p.code.charCodeAt(1) }]]));
    const r = calculerRecap({
      ...base,
      etat: derivePortfolio(beaucoup, h, '2026-10-24'),
      variationJour: Object.fromEntries(beaucoup.map((p, i) => [p.code, i - 4])),
      dividendes: beaucoup.map((p, i) => ({ code: p.code, exDate: `2026-11-1${i}`, montant: 1 })),
    });
    expect(r.meilleures).toHaveLength(3);
    expect(r.moinsBonnes).toHaveLength(3);
    expect(r.dividendes).toHaveLength(3);
    expect(r.secteurs).toHaveLength(5);
    expect(r.secteurs[4].secteur).toBe('Autres');
  });
});
