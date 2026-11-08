import { describe, it, expect } from 'vitest';
import { exerciceRetenu, memesComptes, mentionSecondJeu } from './exerciceRetenu';

const income = [
  { periode: '2025', resultat_net: -6_131_800_226, revenu_total: 80_568_589_451 },
  { periode: '2024', resultat_net: 2_590_611_302, revenu_total: 87_219_126_882 },
];
const balance = [
  { periode: '2025', total_capitaux_propres: 13_822_035_189, dette_court_terme: 11_018_291_667, dette_long_terme: 69_108_844_430 },
  { periode: '2024', total_capitaux_propres: 19_953_835_415, dette_court_terme: 15_409_329_167, dette_long_terme: 32_078_800_331 },
];
const fonda = [
  { year: 2025, revenue: 80_568_589_000, net_income: -6_132_000_000, equity: 17_243_172_000, debt: 78_176_839_000 },
  { year: 2024, revenue: 87_219_127_000, net_income: 2_591_000_000, equity: 24_984_680_000, debt: 45_717_880_000 },
];

describe('memesComptes', () => {
  it('tolérance 2 %, sans point de comparaison on ne conclut pas à un écart', () => {
    expect(memesComptes(13_822_035_189, 17_243_172_000)).toBe(false);
    expect(memesComptes(100, 101.5)).toBe(true);
    expect(memesComptes(null, 5)).toBe(true);
  });
});

describe('exerciceRetenu', () => {
  it('SCRC : comptes SYSCOHADA du dernier exercice, second jeu signalé', () => {
    const e = exerciceRetenu({ income, balance, fundamentals: fonda });
    expect(e.exercice).toBe(2025);
    expect(e.source).toBe('syscohada');
    expect(e.resultatNet).toBe(-6_131_800_226);
    expect(e.chiffreAffaires).toBe(80_568_589_451);
    expect(e.capitauxPropres).toBe(13_822_035_189);
    expect(e.detteFinanciere).toBe(80_127_136_097);
    expect(e.secondJeu).toEqual({ capitauxPropres: 17_243_172_000 });
  });
  it("ordre d'entrée indifférent", () => {
    const e = exerciceRetenu({ income: [...income].reverse(), balance: [...balance].reverse(), fundamentals: [...fonda].reverse() });
    expect(e.exercice).toBe(2025);
  });
  it('comptes concordants : pas de second jeu', () => {
    const e = exerciceRetenu({ income, balance, fundamentals: [{ ...fonda[0]!, equity: 13_900_000_000 }] });
    expect(e.secondJeu).toBeNull();
  });
  it('tables SYSCOHADA absentes : repli sur fundamentals', () => {
    const e = exerciceRetenu({ income: [], balance: [], fundamentals: fonda });
    expect(e.source).toBe('fundamentals');
    expect(e.exercice).toBe(2025);
    expect(e.capitauxPropres).toBe(17_243_172_000);
    expect(e.detteFinanciere).toBe(78_176_839_000);
    expect(e.secondJeu).toBeNull();
  });
  it("bilan absent pour l'exercice : capitaux propres de fundamentals de la même année, sans second jeu", () => {
    const e = exerciceRetenu({ income, balance: [], fundamentals: fonda });
    expect(e.source).toBe('syscohada');
    expect(e.capitauxPropres).toBe(17_243_172_000);
    expect(e.secondJeu).toBeNull();
  });
  it('rien du tout : tout à null', () => {
    const e = exerciceRetenu({ income: [], balance: [], fundamentals: [] });
    expect(e.exercice).toBeNull();
    expect(e.resultatNet).toBeNull();
  });
});

describe('mentionSecondJeu', () => {
  it('cite seulement les capitaux propres en base', () => {
    const m = mentionSecondJeu({ capitauxPropres: 17_243_172_000 })!;
    expect(m).toContain('17,24 Md');
    expect(m).toContain('SYSCOHADA');
    expect(m).not.toMatch(/résultat/i);
  });
  it('rien sans second jeu', () => expect(mentionSecondJeu(null)).toBeNull());
});

describe('chaîne exerciceRetenu → ratiosBilan (SCRC, comptes de la base)', () => {
  it('P/B 2,44 · ROE −44,4 % · dette/CP 5,80 · BPA −312,85, PER non calculable', async () => {
    const { ratiosBilan } = await import('./ratiosBilan');
    const e = exerciceRetenu({ income, balance, fundamentals: fonda });
    const r = ratiosBilan({
      cours: 1720, titres: 19_600_000, resultatNet: e.resultatNet, chiffreAffaires: e.chiffreAffaires,
      capitauxPropres: e.capitauxPropres, detteFinanciere: e.detteFinanciere, capitalisation: 33_712_000_000,
    });
    expect(r.pb).toBeCloseTo(2.44, 2);
    expect(r.roe! * 100).toBeCloseTo(-44.36, 1);
    expect(r.gearing).toBeCloseTo(5.80, 2);
    expect(r.bpa.valeur).toBe(-312.85);
    expect(r.per.valeur).toBeNull();
  });
});
