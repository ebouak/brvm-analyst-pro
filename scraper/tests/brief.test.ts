import { describe, it, expect } from 'vitest';
import { composeBrief, buildBriefData, composeBriefText, type BriefInput } from '../src/brief/compose.js';

const base: BriefInput = {
  dateMarche: '2026-06-12',
  indices: [
    { code: 'BRVMC', valeur: 310.45, variation_pct: 0.52 },
    { code: 'BRVM30', valeur: 155.2, variation_pct: -0.13 },
  ],
  actions: [
    { code: 'SNTS', variation_pct: 2.5, volume: 12000 },
    { code: 'PALC', variation_pct: 5.1, volume: 800 },
    { code: 'SGBC', variation_pct: -1.2, volume: 3000 },
    { code: 'BICC', variation_pct: -3.4, volume: 500 },
    { code: 'ETIT', variation_pct: 0, volume: 90000 },
  ],
  news: [{ titre: 'La BRVM publie son bulletin mensuel de mai 2026', source: 'brvm' }],
  marketSummary: {
    valeur_transactions: 1_959_664_174,
    capitalisation_actions: 16_819_278_896_234,
    capitalisation_obligations: 13_169_178_604_558,
  },
  siteUrl: 'https://example.test',
};

describe('buildBriefData', () => {
  it('structure complète : tendance, breadth, indices normalisés, movers, transactions', () => {
    const data = buildBriefData(base);
    expect(data).not.toBeNull();
    const d = data!;
    expect(d.breadth).toEqual({ hausses: 2, baisses: 2, stables: 1 });
    expect(d.tendance).toBe('mitigee'); // 2 vs 2 : pas de majorité nette
    // Codes normalisés BRVMC → BRVM-C
    expect(d.indices.map((i) => i.code)).toEqual(['BRVM-C', 'BRVM-30']);
    expect(d.top_hausses[0]).toEqual({ code: 'PALC', variation_pct: 5.1 });
    expect(d.top_baisses[0]).toEqual({ code: 'BICC', variation_pct: -3.4 });
    expect(d.volume_total).toBe(106300);
    expect(d.valeur_transactions).toBe(1_959_664_174);
    expect(d.actualites).toHaveLength(1);
  });

  it('tendance haussière si majorité nette de hausses', () => {
    const d = buildBriefData({
      ...base,
      actions: [
        { code: 'A', variation_pct: 1, volume: 1 },
        { code: 'B', variation_pct: 2, volume: 1 },
        { code: 'C', variation_pct: 3, volume: 1 },
        { code: 'D', variation_pct: -1, volume: 1 },
      ],
    });
    expect(d!.tendance).toBe('haussiere');
  });

  it('tendance baissière si majorité nette de baisses', () => {
    const d = buildBriefData({
      ...base,
      actions: [
        { code: 'A', variation_pct: -1, volume: 1 },
        { code: 'B', variation_pct: -2, volume: 1 },
        { code: 'C', variation_pct: -3, volume: 1 },
        { code: 'D', variation_pct: 1, volume: 1 },
      ],
    });
    expect(d!.tendance).toBe('baissiere');
  });

  it('retourne null si aucune action avec variation (pas de note vide)', () => {
    expect(buildBriefData({ ...base, actions: [{ code: 'X', variation_pct: null, volume: null }] })).toBeNull();
    expect(buildBriefData({ ...base, actions: [] })).toBeNull();
  });
});

describe('composeBriefText / composeBrief', () => {
  it('texte Telegram complet avec indices (codes sans tiret en entrée), transactions et lien daté', () => {
    const text = composeBrief(base);
    expect(text).not.toBeNull();
    expect(text!).toContain('Note de conjoncture du');
    expect(text!).toContain('Séance mitigée : 2 hausses · 2 baisses · 1 stables');
    // Le fix du bug : BRVMC en base s'affiche bien BRVM-C
    expect(text!).toContain('BRVM-C : 310,45 (+0,52 %)');
    expect(text!).toContain('BRVM-30 : 155,2 (-0,13 %)');
    expect(text!).toContain('🟢 Hausses : PALC +5,10 % · SNTS +2,50 %');
    expect(text!).toContain('🔴 Baisses : BICC -3,40 % · SGBC -1,20 %');
    expect(text!).toContain('💰 Transactions : 1,96 milliards FCFA');
    expect(text!).toContain('📰 La BRVM publie');
    expect(text!).toContain('https://example.test/brief/2026-06-12?utm_source=telegram');
  });

  it('séance sans actualités ni indices ni market summary : sections absentes, pas de crash', () => {
    const text = composeBrief({ ...base, indices: [], news: [], marketSummary: null });
    expect(text).not.toBeNull();
    expect(text!).not.toContain('📰');
    expect(text!).not.toContain('BRVM-C');
    expect(text!).not.toContain('💰');
  });

  it('séance entièrement en baisse : pas de section hausses', () => {
    const data = buildBriefData({
      ...base,
      actions: [
        { code: 'AAA', variation_pct: -1, volume: 10 },
        { code: 'BBB', variation_pct: -2, volume: 10 },
      ],
    });
    const text = composeBriefText(data!, 'https://example.test');
    expect(text).not.toContain('🟢 Hausses');
    expect(text).toContain('🔴 Baisses : BBB -2,00 % · AAA -1,00 %');
  });
});
