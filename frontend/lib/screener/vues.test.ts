import { describe, it, expect } from 'vitest';
import { niveau, grouperParSecteur } from './vues';
import type { ActionRow } from './filters';

describe('niveau', () => {
  it('variation par paliers signés', () => {
    expect(niveau('variation', 0.2)).toBe(0);
    expect(niveau('variation', -2.5)).toBe(-2);
    expect(niveau('variation', 7.36)).toBe(3);
  });
  it('RSI centré sur 50', () => {
    expect(niveau('rsi', 80.8)).toBe(3);
    expect(niveau('rsi', 22.2)).toBe(-2);
    expect(niveau('rsi', 55)).toBe(0);
  });
  it('rendement sans niveau négatif, donnée absente = null', () => {
    expect(niveau('rendement', 8.02)).toBe(3);
    expect(niveau('rendement', 1.5)).toBe(0);
    expect(niveau('rendement', null)).toBeNull();
  });
});

describe('grouperParSecteur', () => {
  const a = (code: string, secteur: string | null): ActionRow => ({ code, secteur, cours_jour: 1, variation_pct: 0, rsi: null, volume: 0, score_signal: null, rendement_dividende: null });
  it('trie les secteurs, « Non classé » en dernier', () => {
    const g = grouperParSecteur([a('Z', null), a('SNTS', 'Télécommunications'), a('BOAC', 'Services financiers'), a('ABJC', 'Services financiers')]);
    expect(g.map((x) => x.secteur)).toEqual(['Services financiers', 'Télécommunications', 'Non classé']);
    expect(g[0]!.actions.map((x) => x.code)).toEqual(['ABJC', 'BOAC']);
  });
});
