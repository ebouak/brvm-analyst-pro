import { describe, expect, it } from 'vitest';
import {
  analyserPortefeuille,
  base100,
  commenterDividendes,
  epargnePrecaution,
  hausseNecessaire,
  lectureFixing,
  lireMontant,
  liquiditeBrvm,
  pointsDividende,
  simulerPortefeuille,
  type LignePortefeuille,
} from './risques';
import { executerOrdreVente, type NiveauCarnet } from './carnet';
import { simulerScenario } from './allocation';
import type { HistoriqueValeur } from './donneesReelles';

const CINQ: LignePortefeuille[] = [
  { nom: 'Société A', secteur: 'Banques', pct: 20 },
  { nom: 'Société B', secteur: 'Télécoms', pct: 20 },
  { nom: 'Société C', secteur: 'Agro-industrie', pct: 20 },
  { nom: 'Société D', secteur: 'Distribution', pct: 20 },
  { nom: 'Société E', secteur: 'Énergie', pct: 20 },
];
const SANS_CHOC = { marchePct: 0, secteur: null, dividende: null };

describe('hausse nécessaire après une perte', () => {
  it('−20 % demande +25 % (5 000 → 4 000 → 5 000) ; −50 % demande +100 %', () => {
    expect(hausseNecessaire(20)).toBe(25);
    expect(4000 * (1 + hausseNecessaire(20) / 100)).toBe(5000);
    expect(hausseNecessaire(50)).toBe(100);
    expect(hausseNecessaire(10)).toBeCloseTo(11.11, 2);
    expect(hausseNecessaire(0)).toBe(0);
  });
  it('refuse une perte de 100 % ou plus, ou négative', () => {
    expect(() => hausseNecessaire(100)).toThrow();
    expect(() => hausseNecessaire(-5)).toThrow();
    expect(() => hausseNecessaire(Number.NaN)).toThrow();
  });
});

describe('épargne de précaution', () => {
  it('reprend l’exemple de la leçon : 250 000 × 6 = 1 500 000 ; et le quiz : 200 000 × 6 = 1 200 000', () => {
    const r = epargnePrecaution('250 000');
    expect(r).toMatchObject({ ok: true, trois: 750_000, six: 1_500_000, repere: 1_500_000 });
    expect(epargnePrecaution('200000')).toMatchObject({ ok: true, six: 1_200_000 });
  });
  it('compare à l’épargne disponible, sans reste négatif', () => {
    expect(epargnePrecaution('100 000', '400 000')).toMatchObject({ ok: true, reste: 200_000 });
    expect(epargnePrecaution('100 000', '900 000')).toMatchObject({ ok: true, reste: 0 });
  });
  it('états vides et erreurs de saisie', () => {
    expect(epargnePrecaution('')).toMatchObject({ ok: false });
    expect(epargnePrecaution('abc')).toMatchObject({ ok: false });
    expect(epargnePrecaution('-5')).toMatchObject({ ok: false });
    expect(epargnePrecaution('0')).toMatchObject({ ok: false });
    expect(epargnePrecaution('1000000000')).toMatchObject({ ok: false });
    expect(epargnePrecaution('100000', 'x')).toMatchObject({ ok: false });
  });
  it('lit les montants avec espaces ou virgule', () => {
    expect(lireMontant('1 250 000')).toBe(1_250_000);
    expect(lireMontant('12,5')).toBe(12.5);
    expect(lireMontant('12a')).toBeNull();
  });
});

describe('portefeuille : concentration', () => {
  it('cinq lignes égales : dans les repères, équivalent à 5 lignes', () => {
    const a = analyserPortefeuille(CINQ);
    expect(a.totalPct).toBe(100);
    expect(a.nombreEffectif).toBeCloseTo(5, 10);
    expect(a.dansLesReperes).toBe(true);
  });
  it('une seule valeur : 1 ligne effective, alerte société et secteur', () => {
    const a = analyserPortefeuille([{ nom: 'Société A', secteur: 'Banques', pct: 100 }]);
    expect(a.nombreEffectif).toBe(1);
    expect(a.alertes).toHaveLength(2);
  });
  it('trois banques à 20 % : chaque société dans le repère, le secteur (60 %) au-dessus', () => {
    const a = analyserPortefeuille([
      { nom: 'A', secteur: 'Banques', pct: 20 },
      { nom: 'B', secteur: 'Banques', pct: 20 },
      { nom: 'C', secteur: 'Banques', pct: 20 },
      { nom: 'D', secteur: 'Télécoms', pct: 20 },
      { nom: 'E', secteur: 'Énergie', pct: 20 },
    ]);
    expect(a.parSecteur[0]).toEqual({ secteur: 'Banques', pct: 60 });
    expect(a.alertes).toEqual([expect.stringContaining('Banques pèse 60 %')]);
  });
});

describe('portefeuille : chocs, cohérents avec la leçon et avec allocation.ts', () => {
  const base = { capital: 1_000_000, rendementPct: 8, lignes: CINQ };
  it('le tableau de la leçon : un dividende divisé par deux → 80 000 à 72 000 (−10 %) ; tout sur une valeur → 40 000 (−50 %)', () => {
    const r = simulerPortefeuille(base, { ...SANS_CHOC, dividende: { nom: 'Société A', reductionPct: 50 } });
    expect([r.revenuAvant, r.revenuApres, r.variationRevenuPct]).toEqual([80_000, 72_000, -10]);
    const seul = simulerPortefeuille({ ...base, lignes: [{ nom: 'Société A', secteur: 'Banques', pct: 100 }] }, { ...SANS_CHOC, dividende: { nom: 'Société A', reductionPct: 50 } });
    expect([seul.revenuApres, seul.variationRevenuPct]).toEqual([40_000, -50]);
  });
  it('la diversification ne protège pas d’une baisse générale : −20 % de marché = −20 % de capital', () => {
    const r = simulerPortefeuille(base, { ...SANS_CHOC, marchePct: 20 });
    expect([r.capitalApres, r.variationCapitalPct, r.revenuApres]).toEqual([800_000, -20, 80_000]);
  });
  it('mêmes résultats que simulerScenario (allocation.ts) sur un choc sectoriel', () => {
    const r = simulerPortefeuille(base, { ...SANS_CHOC, secteur: { nom: 'Banques', baissePct: 30 } });
    const ref = simulerScenario({ capital: 1_000_000, rendement_pct: 8, lignes: CINQ.map((l) => ({ nom: l.secteur, pct: l.pct })) }, { type: 'secteur', nom: 'Banques', baisse_pct: 30 });
    expect(r.capitalApres).toBe(ref.capitalApres);
    expect(r.variationCapitalPct).toBe(ref.variationCapitalPct);
  });
  it('chocs cumulés : marché −10 % puis secteur −30 % sur une ligne de 20 %', () => {
    const r = simulerPortefeuille(base, { marchePct: 10, secteur: { nom: 'Banques', baissePct: 30 }, dividende: null });
    // 800 000 × 0,9 + 200 000 × 0,9 × 0,7 = 720 000 + 126 000
    expect(r.capitalApres).toBe(846_000);
  });
  it('refuse une répartition qui ne fait pas 100 %', () => {
    expect(() => simulerPortefeuille({ ...base, lignes: CINQ.slice(0, 4) }, SANS_CHOC)).toThrow(/100 %/);
  });
});

describe('vente et fixing', () => {
  const ACHAT: NiveauCarnet[] = [
    { prix: 3270, quantite: 2000 },
    { prix: 3260, quantite: 3000 },
    { prix: 3250, quantite: 4000 },
  ];
  it('vente au mieux de 4 000 : 2 000 à 3 270 + 2 000 à 3 260, prix moyen 3 265', () => {
    const r = executerOrdreVente(ACHAT, { sens: 'vente', quantite: 4000, limite: 'au_mieux', condition: 'sans', validite: 'jour' });
    expect(r.statut).toBe('execute');
    expect(r.prixMoyen).toBe(3265);
    expect(r.coutTotal).toBe(2000 * 3270 + 2000 * 3260);
    expect(r.explication).toMatch(/inférieur au meilleur prix affiché/);
  });
  it('vente limitée à 3 265 : seuls les 2 000 titres à 3 270 sont servis, le reste attend', () => {
    const r = executerOrdreVente(ACHAT, { sens: 'vente', quantite: 5000, limite: { prix: 3265 }, condition: 'sans', validite: 'mensuel' });
    expect([r.statut, r.quantiteServie, r.reliquat]).toEqual(['partiel', 2000, 3000]);
    expect(r.explication).toContain('mensuel');
  });
  it('vente tout ou rien de 10 000 : 9 000 demandés au total, rien n’est servi ; sans limite : rejet', () => {
    expect(executerOrdreVente(ACHAT, { sens: 'vente', quantite: 10_000, limite: 'au_mieux', condition: 'tout_ou_rien', validite: 'jour' }).quantiteServie).toBe(0);
    expect(executerOrdreVente(ACHAT, { sens: 'vente', quantite: 100, limite: null, condition: 'sans', validite: 'jour' }).statut).toBe('rejete');
    expect(executerOrdreVente(ACHAT, { sens: 'vente', quantite: 1.5, limite: 'au_mieux', condition: 'sans', validite: 'jour' }).statut).toBe('rejete');
  });
  it('au fixing, aucun prix ni aucune quantité exécutée n’est annoncé', () => {
    const VENTE: NiveauCarnet[] = [{ prix: 3280, quantite: 3500 }, { prix: 3290, quantite: 4500 }, { prix: 3300, quantite: 5500 }];
    const f = lectureFixing(VENTE, { sens: 'achat', quantite: 5000, limite: { prix: 3290 }, condition: 'sans' });
    expect(f.quantiteCompatible).toBe(8000);
    expect(f.phrases.join(' ')).toMatch(/cours d’équilibre unique/);
    expect(f.phrases.join(' ')).toMatch(/3\s290 FCFA ou moins/);
    expect(f.phrases.join(' ')).not.toMatch(/servi en totalité :|prix moyen/i);
  });
});

describe('dividendes : commentaire tiré des seules données affichées', () => {
  const h: HistoriqueValeur = {
    code: 'TEST',
    nom: 'Société test',
    versements: 4,
    baisses: 1,
    montants: [
      { exercice: 2020, montant: 100, baseNette: true, base: 'net' },
      { exercice: 2021, montant: 80, baseNette: true, base: 'net' },
      { exercice: 2022, montant: null, baseNette: false, base: null },
      { exercice: 2023, montant: 90, baseNette: false, base: null },
      { exercice: 2024, montant: 120, baseNette: true, base: 'net' },
    ],
  };
  it('qualifie chaque exercice : baisse, reprise après baisse, trou, hausse', () => {
    expect(pointsDividende(h).map((p) => p.nature)).toEqual(['premier', 'baisse', 'absent', 'reprise', 'hausse']);
    expect(pointsDividende(h)[1]!.variationPct).toBe(-20);
    expect(pointsDividende(h)[3]!.base).toBe('non_verifiee');
  });
  it('le commentaire cite les montants, la baisse, la reprise, le trou et l’écart de base', () => {
    const t = commenterDividendes(h).join(' ');
    expect(t).toContain('4 exercices sur 5');
    expect(t).toContain('+20 % sur la période');
    expect(t).toContain('Baisse sur l’exercice 2021 : −20 %');
    expect(t).toContain('Reprise sur l’exercice 2023 : +12,5 %');
    expect(t).toContain('l’exercice 2022');
    expect(t).toMatch(/même base/);
    expect(t).not.toMatch(/NaN|undefined/);
  });
  it('base 100 sur le premier exercice versé, trous conservés', () => {
    expect(base100(h)).toEqual([100, 80, null, 90, 120]);
  });
});

describe('liquidité : données réelles figées', () => {
  const l = liquiditeBrvm(['SNTS', 'PALC', 'NTLC', 'SPHC']);
  it('65 séances du 24/08 au 23/11/2026, mêmes parts que la leçon 1 (Sonatel 40,9 %, dix premières 71,9 %)', () => {
    expect(l.periode).toEqual({ debut: '2026-08-24', fin: '2026-11-23', seances: 65 });
    expect(l.plusEchangee.code).toBe('SNTS');
    expect(Math.round(l.plusEchangee.partPct * 10) / 10).toBe(40.9);
    expect(Math.round(l.partTop10Pct * 10) / 10).toBe(71.9);
  });
  it('les quatre sociétés de la leçon sont présentes ; les moins échangées sont nommées', () => {
    expect(l.lignes.map((x) => x.code)).toEqual(['SNTS', 'PALC', 'NTLC', 'SPHC']);
    expect(l.moinsEchangees.map((x) => x.seancesSansEchange)).toEqual([49, 49]);
  });
});
