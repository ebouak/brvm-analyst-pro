import { describe, it, expect } from 'vitest';
import { exemplesRendement, historiqueDividendes, type LigneDividende } from './donneesReelles';

const div = (code: string, exercice: number, montant: number | null, base = 'net', extra: Partial<LigneDividende> = {}): LigneDividende => ({
  code, exercice, montant, base_fiscale: base, payment_date: null, source: 'brvm-boc', ...extra,
});

const DIVIDENDES: LigneDividende[] = [
  div('SNTS', 2021, 1400, 'inconnu'), div('SNTS', 2022, 1500, 'inconnu'), div('SNTS', 2023, 1575, 'inconnu'),
  div('SNTS', 2024, 1655, 'inconnu'), div('SNTS', 2025, 1740, 'net', { payment_date: '2026-05-26' }),
  div('SPHC', 2021, 365.4, 'inconnu'), div('SPHC', 2022, 294, 'inconnu'), div('SPHC', 2023, 65, 'inconnu'),
  div('SPHC', 2024, 324, 'inconnu'), div('SPHC', 2025, 430, 'net', { source: 'sikafinance' }),
  div('XXXX', 2025, 0, 'net'),
];
const NOMS = { SNTS: 'SONATEL', SPHC: 'SAPH CI', XXXX: 'Sans dividende' };
// Cours synthétiques (pas des cours de marché).
const COURS = [
  { code: 'SNTS', cours: 29_000, date: '2026-10-19' },
  { code: 'SPHC', cours: 7_000, date: '2026-10-19' },
];

describe('exemples réels — rendement au dernier cours', () => {
  const r = exemplesRendement(['SNTS', 'SPHC', 'XXXX', 'ABSENT'], NOMS, DIVIDENDES, COURS, 300);

  it('dernier exercice distribué, rendement net = dividende ÷ cours, revenu pour 300 actions', () => {
    expect(r.lignes[0]).toMatchObject({
      code: 'SNTS', nom: 'SONATEL', exercice: 2025, dividende: 1740, baseNette: true,
      paiement: '2026-05-26', cours: 29_000, dateCours: '2026-10-19', revenu: 522_000,
    });
    expect(r.lignes[0]!.rendementPct).toBeCloseTo(6, 6);
  });

  it('une valeur sans dividende positif ou sans cours est nommée, jamais inventée', () => {
    expect(r.lignes.map((l) => l.code)).toEqual(['SNTS', 'SPHC']);
    expect(r.manquants).toEqual(['XXXX', 'ABSENT']);
  });

  it('la date affichée est celle des cours, la plus récente', () => {
    expect(r.dateCours).toBe('2026-10-19');
  });
});

describe('exemples réels — historique des dividendes', () => {
  const h = historiqueDividendes(['SNTS', 'SPHC'], NOMS, DIVIDENDES, 5);

  it('les cinq derniers exercices, du plus ancien au plus récent', () => {
    expect(h.exercices).toEqual([2021, 2022, 2023, 2024, 2025]);
  });

  it('régularité : SONATEL augmente chaque année, SAPH baisse deux fois', () => {
    const snts = h.lignes.find((l) => l.code === 'SNTS')!;
    const sphc = h.lignes.find((l) => l.code === 'SPHC')!;
    expect(snts).toMatchObject({ versements: 5, baisses: 0 });
    expect(sphc).toMatchObject({ versements: 5, baisses: 2 });
    expect(sphc.montants.map((m) => m.montant)).toEqual([365.4, 294, 65, 324, 430]);
  });

  it('un exercice sans ligne reste vide (null), pas zéro', () => {
    const h2 = historiqueDividendes(['SNTS'], NOMS, DIVIDENDES.filter((d) => !(d.code === 'SNTS' && d.exercice === 2023)), 5);
    expect(h2.lignes[0]!.montants[2]).toEqual({ exercice: 2023, montant: null, baseNette: false });
    expect(h2.lignes[0]!.versements).toBe(4);
  });
});

import { ratiosValeurs } from './donneesReelles';

describe('ratiosValeurs', () => {
  const cot = [{ code: 'AAA', cours: 1000, date: '2026-11-13' }, { code: 'BBB', cours: 500, date: '2026-11-13' }];
  const fd = [
    { code: 'AAA', year: 2024, net_income: 80, equity: 400 },
    { code: 'AAA', year: 2025, net_income: 100, equity: 500 },
    { code: 'AAA', year: 2026, net_income: 120, equity: null },
    { code: 'BBB', year: 2025, net_income: -10, equity: 100 },
  ];
  it('dernier exercice complet, ratios exacts, perte sans PER, manquant nommé', () => {
    const r = ratiosValeurs(['AAA', 'BBB', 'CCC'], {}, cot, fd, { AAA: 1, BBB: 1, CCC: 1 });
    const a = r.lignes[0]!;
    expect(a.exercice).toBe(2025);
    expect(a.bpa).toBe(100);
    expect(a.per).toBe(10);
    expect(a.pb).toBe(2);
    expect(a.roePct).toBe(20);
    expect(r.lignes[1]!.per).toBeNull();
    expect(r.manquants).toEqual(['CCC']);
  });
});

import { lectureTechnique } from './donneesReelles';

describe('lectureTechnique', () => {
  const serie = (n: number, f: (i: number) => number) =>
    Array.from({ length: n }, (_, i) => ({ date: `2026-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`, cours: f(i) }));
  it('hausse régulière : au-dessus des deux moyennes, RSI en surachat ; historique court nommé', () => {
    const r = lectureTechnique(['UP', 'COURT'], {}, { UP: serie(60, (i) => 100 + i), COURT: serie(30, () => 100) });
    const l = r.lignes[0]!;
    expect(l.cours).toBe(159);
    expect(l.mm20).toBeCloseTo(149.5, 6);
    expect(l.mm50).toBeCloseTo(134.5, 6);
    expect(l.position).toBe('au-dessus des deux');
    expect(l.zoneRsi).toBe('surachat');
    expect(r.manquants).toEqual(['COURT']);
  });
  it('baisse régulière : sous les deux moyennes, RSI en survente', () => {
    const l = lectureTechnique(['DN'], {}, { DN: serie(60, (i) => 300 - i) }).lignes[0]!;
    expect(l.position).toBe('sous les deux');
    expect(l.zoneRsi).toBe('survente');
  });
});
