import { describe, it, expect } from 'vitest';
import { derivePortfolio, type RawPosition, type PricePoint } from './derive';

function hist(...pts: [string, number][]): PricePoint[] {
  return pts.map(([date, cours]) => ({ date, cours }));
}

describe('derivePortfolio', () => {
  it('valorise et calcule le P&L latent à partir des positions', () => {
    const positions: RawPosition[] = [
      { code: 'SNTS', quantite: 10, prix_entree: 1000, date_entree: '2026-01-05', secteur: 'Télécom' },
    ];
    const ph = new Map<string, PricePoint[]>([
      ['SNTS', hist(['2026-01-05', 1000], ['2026-02-01', 1100], ['2026-03-01', 1200])],
    ]);
    const s = derivePortfolio(positions, ph, '2026-03-01');
    expect(s.currentValue).toBe(12000);
    expect(s.investedCapital).toBe(10000);
    expect(s.latentPnl).toBe(2000);
    expect(s.latentPnlPct).toBeCloseTo(0.2, 5);
    expect(s.positions[0]!.poids).toBeCloseTo(1, 5);
  });

  it('construit une courbe d’équité respectant les dates d’entrée', () => {
    const positions: RawPosition[] = [
      { code: 'AAA', quantite: 10, prix_entree: 100, date_entree: '2026-01-01' },
      { code: 'BBB', quantite: 5, prix_entree: 200, date_entree: '2026-02-01' }, // entre plus tard
    ];
    const ph = new Map<string, PricePoint[]>([
      ['AAA', hist(['2026-01-01', 100], ['2026-02-01', 110], ['2026-03-01', 120])],
      ['BBB', hist(['2026-01-01', 200], ['2026-02-01', 200], ['2026-03-01', 220])],
    ]);
    const s = derivePortfolio(positions, ph, '2026-03-01');
    // En janvier : seulement AAA (10×100 = 1000)
    const jan = s.equityCurve.find((p) => p.date === '2026-01-01')!;
    expect(jan.value).toBe(1000);
    expect(jan.invested).toBe(1000);
    // En mars : AAA 10×120 + BBB 5×220 = 1200 + 1100 = 2300
    const mar = s.equityCurve.find((p) => p.date === '2026-03-01')!;
    expect(mar.value).toBe(2300);
    expect(mar.invested).toBe(2000); // 10×100 + 5×200
  });

  it('forward-fill : utilise le dernier cours connu si la date manque', () => {
    const positions: RawPosition[] = [
      { code: 'AAA', quantite: 1, prix_entree: 100, date_entree: '2026-01-01' },
      { code: 'BBB', quantite: 1, prix_entree: 50, date_entree: '2026-01-01' },
    ];
    const ph = new Map<string, PricePoint[]>([
      ['AAA', hist(['2026-01-01', 100], ['2026-01-03', 130])],
      ['BBB', hist(['2026-01-01', 50], ['2026-01-02', 60], ['2026-01-03', 70])],
    ]);
    const s = derivePortfolio(positions, ph, '2026-01-03');
    // au 2026-01-02, AAA n'a pas de point => forward-fill 100 ; BBB = 60
    const d2 = s.equityCurve.find((p) => p.date === '2026-01-02')!;
    expect(d2.value).toBe(160);
  });

  it('liquidités : valeur portée par prix_entree, constante', () => {
    const positions: RawPosition[] = [
      { code: 'CASH', quantite: 1, prix_entree: 500000, date_entree: null, is_liquidites: true },
      { code: 'AAA', quantite: 10, prix_entree: 100, date_entree: '2026-01-01' },
    ];
    const ph = new Map<string, PricePoint[]>([
      ['AAA', hist(['2026-01-01', 100], ['2026-02-01', 150])],
    ]);
    const s = derivePortfolio(positions, ph, '2026-02-01');
    expect(s.currentValue).toBe(500000 + 1500);
    const feb = s.equityCurve.find((p) => p.date === '2026-02-01')!;
    expect(feb.value).toBe(500000 + 1500);
  });

  it('portefeuille vide => état nul', () => {
    const s = derivePortfolio([], new Map(), '2026-03-01');
    expect(s.currentValue).toBe(0);
    expect(s.equityCurve).toHaveLength(0);
  });
});
