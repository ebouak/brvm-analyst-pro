import { describe, it, expect } from 'vitest';
import {
  evaluerSignaux, intervalleBootstrap, verdictDe, formaterRapport,
  MIN_INDEPENDANTS, type PointCours, type PointSignal, type Tranche,
} from '../src/signaux/evaluation.js';

/** Dates de séance synthétiques J000, J001… (ordre lexicographique = chronologique). */
const jour = (i: number) => `J${String(i).padStart(3, '0')}`;
const serie = (code: string, prix: number[]): PointCours[] => prix.map((cours, i) => ({ code, date: jour(i), cours }));
const TOUT: Tranche[] = [{ id: 'tout', libelle: 'tout', min: -Infinity, max: Infinity }];

describe('evaluerSignaux — mesure', () => {
  it('rendement entre la clôture du signal et la clôture h séances plus tard', () => {
    const cours = serie('A', [100, 101, 102, 103, 104, 110, 90]);
    const res = evaluerSignaux([{ code: 'A', date: jour(0), score: 0.9 }], cours, { horizons: [5], tranches: TOUT });
    expect(res[0].n).toBe(1);
    expect(res[0].rendementMoyen).toBeCloseTo(10, 6); // 110 / 100 − 1
  });

  it("écarte un signal sans cours futur (aucune donnée inventée)", () => {
    const cours = serie('A', [100, 101, 102]);
    const res = evaluerSignaux([{ code: 'A', date: jour(1), score: 0.9 }], cours, { horizons: [5], tranches: TOUT });
    expect(res[0].n).toBe(0);
    expect(res[0].excesMoyen).toBeNull();
    expect(res[0].verdict).toBe('insuffisant');
  });

  it("mesure l'écart à la moyenne des valeurs notées le même jour", () => {
    const cours = [...serie('A', [100, 110]), ...serie('B', [100, 100])];
    const signaux: PointSignal[] = [
      { code: 'A', date: jour(0), score: 0.9 },
      { code: 'B', date: jour(0), score: -0.9 },
    ];
    const tranches: Tranche[] = [
      { id: 'haut', libelle: 'haut', min: 0, max: Infinity },
      { id: 'bas', libelle: 'bas', min: -Infinity, max: 0 },
    ];
    const [haut, bas] = evaluerSignaux(signaux, cours, { horizons: [1], tranches });
    expect(haut.excesMoyen).toBeCloseTo(5, 6); // +10 face à une moyenne de +5
    expect(bas.excesMoyen).toBeCloseTo(-5, 6);
  });

  it('ne compte qu’un signal par valeur toutes les h séances (fenêtres sans chevauchement)', () => {
    const prix = Array.from({ length: 30 }, (_, i) => 100 + i);
    const signaux = prix.map((_, i) => ({ code: 'A', date: jour(i), score: 0.9 }));
    const [r] = evaluerSignaux(signaux, serie('A', prix), { horizons: [5], tranches: TOUT });
    expect(r.n).toBe(25); // positions 0..24 ont un cours à +5
    expect(r.nIndependants).toBe(5); // positions 0, 5, 10, 15, 20
  });

  it('borne achat STRICTE comme le moteur : 0,6 pile reste hors de « achat »', () => {
    const cours = serie('A', [100, 110]);
    const res = evaluerSignaux([{ code: 'A', date: jour(0), score: 0.6 }], cours, { horizons: [1] });
    expect(res.find((r) => r.tranche.id === 'achat')!.n).toBe(0);
    expect(res.find((r) => r.tranche.id === 'p50')!.n).toBe(1);
  });

  it('borne vente STRICTE : −0,6 pile reste hors de « vente »', () => {
    const cours = serie('A', [100, 90]);
    const res = evaluerSignaux([{ code: 'A', date: jour(0), score: -0.6 }], cours, { horizons: [1] });
    expect(res.find((r) => r.tranche.id === 'vente')!.n).toBe(0);
    expect(res.find((r) => r.tranche.id === 'm45')!.n).toBe(1);
  });
});

describe('verdict', () => {
  it('sous le minimum de cas indépendants : « insuffisant », même avec un intervalle net', () => {
    expect(verdictDe(MIN_INDEPENDANTS - 1, [1, 2])).toBe('insuffisant');
  });
  it('intervalle au-dessus de zéro : surperformance prouvée', () => {
    expect(verdictDe(MIN_INDEPENDANTS, [0.1, 2])).toBe('prouve_hausse');
  });
  it('intervalle sous zéro : sous-performance prouvée', () => {
    expect(verdictDe(MIN_INDEPENDANTS, [-2, -0.1])).toBe('prouve_baisse');
  });
  it('intervalle qui contient zéro : non prouvé', () => {
    expect(verdictDe(MIN_INDEPENDANTS, [-1, 1])).toBe('non_prouve');
  });

  it('de bout en bout : un signal réellement porteur est reconnu, un bruit symétrique ne l’est pas', () => {
    // 40 valeurs : les « hautes » montent de 5 %, les « basses » de 0 %, sur
    // UNE fenêtre chacune → 40 cas indépendants dans chaque tranche.
    const cours: PointCours[] = [];
    const signaux: PointSignal[] = [];
    for (let k = 0; k < 40; k++) {
      cours.push(...serie(`H${k}`, [100, 105]), ...serie(`L${k}`, [100, 100]));
      signaux.push({ code: `H${k}`, date: jour(0), score: 0.9 }, { code: `L${k}`, date: jour(0), score: -0.9 });
    }
    const tranches: Tranche[] = [
      { id: 'haut', libelle: 'haut', min: 0, max: Infinity },
      { id: 'bas', libelle: 'bas', min: -Infinity, max: 0 },
    ];
    const [haut, bas] = evaluerSignaux(signaux, cours, { horizons: [1], tranches });
    expect(haut.nIndependants).toBe(40);
    expect(haut.verdict).toBe('prouve_hausse');
    expect(bas.verdict).toBe('prouve_baisse');

    // Bruit symétrique autour du marché : rien de prouvé.
    const coursB: PointCours[] = [];
    const sigB: PointSignal[] = [];
    for (let k = 0; k < 40; k++) {
      coursB.push(...serie(`N${k}`, [100, k % 2 ? 103 : 97]));
      sigB.push({ code: `N${k}`, date: jour(0), score: 0.9 });
    }
    const [bruit] = evaluerSignaux(sigB, coursB, { horizons: [1], tranches: TOUT });
    expect(bruit.verdict).toBe('non_prouve');
  });
});

describe('intervalleBootstrap', () => {
  it('est reproductible à graine égale', () => {
    const xs = Array.from({ length: 50 }, (_, i) => Math.sin(i) * 3);
    expect(intervalleBootstrap(xs, 1000, 7)).toEqual(intervalleBootstrap(xs, 1000, 7));
  });
  it('refuse de conclure sur moins de 10 valeurs', () => {
    expect(intervalleBootstrap([1, 2, 3])).toBeNull();
  });
});

describe('formaterRapport', () => {
  it('produit un tableau par horizon, avec les verdicts en clair', () => {
    const cours = serie('A', [100, 110]);
    const res = evaluerSignaux([{ code: 'A', date: jour(0), score: 0.9 }], cours, { horizons: [1] });
    const md = formaterRapport(res, { debut: '2026-05-26', fin: '2026-10-30', nSignaux: 1 });
    expect(md).toContain('### Horizon 1 séances');
    expect(md).toContain('> 0,60 (achat actuel)');
    expect(md).toContain('échantillon insuffisant');
  });
});

describe('TRANCHES_DEFAUT', () => {
  it('couvrent tout score sans trou ni double compte', async () => {
    const { TRANCHES_DEFAUT } = await import('../src/signaux/evaluation.js');
    const cours = serie('A', [100, 101]);
    for (const score of [-1, -0.6, -0.45, -0.3, 0, 0.3, 0.45, 0.5, 0.6, 0.6000001, 1]) {
      const res = evaluerSignaux([{ code: 'A', date: jour(0), score }], cours, { horizons: [1], tranches: TRANCHES_DEFAUT });
      expect(res.reduce((s, r) => s + r.n, 0), `score ${score}`).toBe(1);
    }
  });
});
