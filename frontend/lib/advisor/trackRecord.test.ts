import { describe, it, expect } from 'vitest';
import { computeFlips, attachPerformance, computeStats, type AdvisorHistoryRow } from './trackRecord';

const h = (date: string, code: string, action: AdvisorHistoryRow['action'], conviction = 70): AdvisorHistoryRow =>
  ({ date_marche: date, code, action, conviction });

describe('computeFlips', () => {
  it('détecte les transitions par code, ignore les jours sans changement', () => {
    const flips = computeFlips([
      h('2026-06-01', 'SNTS', 'conserver'),
      h('2026-06-02', 'SNTS', 'conserver'),
      h('2026-06-03', 'SNTS', 'acheter'),
      h('2026-06-04', 'SNTS', 'acheter'),
      h('2026-06-01', 'PALC', 'acheter'),
      h('2026-06-03', 'PALC', 'vendre'),
    ]);
    expect(flips).toHaveLength(2);
    expect(flips.find((f) => f.code === 'SNTS')).toMatchObject({ date: '2026-06-03', from: 'conserver', to: 'acheter' });
    expect(flips.find((f) => f.code === 'PALC')).toMatchObject({ date: '2026-06-03', from: 'acheter', to: 'vendre' });
  });

  it('aucune bascule avec un seul snapshot (rien d\'antidaté)', () => {
    expect(computeFlips([h('2026-06-01', 'SNTS', 'acheter')])).toHaveLength(0);
  });
});

describe('attachPerformance', () => {
  const series = new Map([
    ['SNTS', [
      { date: '2026-06-03', close: 100 },
      { date: '2026-06-10', close: 110 },
    ]],
  ]);

  it('mesure la perf depuis la clôture du jour de bascule', () => {
    const [f] = attachPerformance(
      [{ code: 'SNTS', date: '2026-06-03', from: 'conserver', to: 'acheter', conviction: 70 }],
      series,
    );
    expect(f.coursBascule).toBe(100);
    expect(f.coursActuel).toBe(110);
    expect(f.perfPct).toBeCloseTo(10, 5);
    expect(f.correct).toBe(true);
  });

  it('jamais de cours ANTÉRIEUR à la bascule comme référence', () => {
    const [f] = attachPerformance(
      [{ code: 'SNTS', date: '2026-06-05', from: 'conserver', to: 'acheter', conviction: 70 }],
      series,
    );
    expect(f.coursBascule).toBe(110); // première clôture ≥ 2026-06-05
  });

  it('vendre puis baisse du cours = bascule correcte', () => {
    const s = new Map([['PALC', [{ date: '2026-06-03', close: 100 }, { date: '2026-06-10', close: 90 }]]]);
    const [f] = attachPerformance(
      [{ code: 'PALC', date: '2026-06-03', from: 'acheter', to: 'vendre', conviction: 60 }],
      s,
    );
    expect(f.perfPct).toBeCloseTo(-10, 5);
    expect(f.correct).toBe(true);
  });

  it('bascule vers conserver : non notée (correct = null)', () => {
    const [f] = attachPerformance(
      [{ code: 'SNTS', date: '2026-06-03', from: 'acheter', to: 'conserver', conviction: 50 }],
      series,
    );
    expect(f.correct).toBeNull();
  });

  it('cours manquants → perf null, jamais 0 inventé', () => {
    const [f] = attachPerformance(
      [{ code: 'INCONNU', date: '2026-06-03', from: 'conserver', to: 'acheter', conviction: 70 }],
      series,
    );
    expect(f.perfPct).toBeNull();
    expect(f.correct).toBeNull();
  });
});

describe('computeStats', () => {
  it('hit rate uniquement sur les bascules notées', () => {
    const flips = attachPerformance(
      [
        { code: 'SNTS', date: '2026-06-03', from: 'conserver', to: 'acheter', conviction: 70 },
        { code: 'PALC', date: '2026-06-03', from: 'acheter', to: 'vendre', conviction: 60 },
        { code: 'SNTS', date: '2026-06-03', from: 'acheter', to: 'conserver', conviction: 50 },
      ],
      new Map([
        ['SNTS', [{ date: '2026-06-03', close: 100 }, { date: '2026-06-10', close: 110 }]],
        ['PALC', [{ date: '2026-06-03', close: 100 }, { date: '2026-06-10', close: 105 }]],
      ]),
    );
    const stats = computeStats(flips);
    expect(stats.nb).toBe(3);
    expect(stats.notees).toBe(2); // conserver non noté
    expect(stats.correctes).toBe(1); // achat SNTS ✓, vente PALC ✗ (le cours a monté)
    expect(stats.hitRate).toBeCloseTo(50, 5);
    expect(stats.perfMoyenneAchat).toBeCloseTo(10, 4);
    expect(stats.perfMoyenneVente).toBeCloseTo(5, 4);
  });
});
