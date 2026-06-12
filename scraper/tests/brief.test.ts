import { describe, it, expect } from 'vitest';
import { composeBrief, type BriefInput } from '../src/brief/compose.js';

const base: BriefInput = {
  dateMarche: '2026-06-12',
  indices: [
    { code: 'BRVM-C', valeur: 310.45, variation_pct: 0.52 },
    { code: 'BRVM-30', valeur: 155.2, variation_pct: -0.13 },
  ],
  actions: [
    { code: 'SNTS', variation_pct: 2.5, volume: 12000 },
    { code: 'PALC', variation_pct: 5.1, volume: 800 },
    { code: 'SGBC', variation_pct: -1.2, volume: 3000 },
    { code: 'BICC', variation_pct: -3.4, volume: 500 },
    { code: 'ETIT', variation_pct: 0, volume: 90000 },
  ],
  news: [{ titre: 'La BRVM publie son bulletin mensuel de mai 2026' }],
  siteUrl: 'https://example.test',
};

describe('composeBrief', () => {
  it('compose un brief complet avec indices, hausses, baisses, volume et news', () => {
    const brief = composeBrief(base);
    expect(brief).not.toBeNull();
    const text = brief!;
    expect(text).toContain('Brief de séance du');
    expect(text).toContain('BRVM-C : 310,45 (+0,52 %)');
    expect(text).toContain('BRVM-30');
    // Hausses triées décroissantes : PALC d'abord
    expect(text).toContain('🟢 Hausses : PALC +5,10 % · SNTS +2,50 %');
    // Baisses : la plus forte baisse d'abord
    expect(text).toContain('🔴 Baisses : BICC -3,40 % · SGBC -1,20 %');
    expect(text).toContain('Volume échangé');
    expect(text).toContain('📰 La BRVM publie');
    expect(text).toContain('https://example.test/societes?utm_source=telegram');
    // Format compact : pas plus de ~14 lignes
    expect(text.split('\n').length).toBeLessThanOrEqual(14);
  });

  it('retourne null si aucune action avec variation (pas de brief vide)', () => {
    expect(
      composeBrief({ ...base, actions: [{ code: 'X', variation_pct: null, volume: null }] }),
    ).toBeNull();
    expect(composeBrief({ ...base, actions: [] })).toBeNull();
  });

  it('gère une séance sans actualités et sans indices', () => {
    const brief = composeBrief({ ...base, indices: [], news: [] });
    expect(brief).not.toBeNull();
    expect(brief!).not.toContain('📰');
    expect(brief!).not.toContain('BRVM-C');
  });

  it('séance entièrement en baisse : pas de section hausses', () => {
    const brief = composeBrief({
      ...base,
      actions: [
        { code: 'AAA', variation_pct: -1, volume: 10 },
        { code: 'BBB', variation_pct: -2, volume: 10 },
      ],
    });
    expect(brief!).not.toContain('🟢');
    expect(brief!).toContain('🔴 Baisses : BBB -2,00 % · AAA -1,00 %');
  });
});
