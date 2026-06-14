import { describe, it, expect } from 'vitest';
import { readIndicators } from './commentary';

describe('readIndicators', () => {
  it('surachat + MACD négatif + tendance haussière => mixte', () => {
    const r = readIndicators({ rsi: 72, macd: -10, ma20: 110, ma50: 100 });
    expect(r.tone).toBe('mixte');
    expect(r.points.some((p) => /surachat/i.test(p))).toBe(true);
    expect(r.points.some((p) => /momentum orienté à la baisse/i.test(p))).toBe(true);
  });

  it('survente + MACD positif + MA20>MA50 => haussier', () => {
    const r = readIndicators({ rsi: 25, macd: 15, ma20: 110, ma50: 100 });
    expect(r.tone).toBe('haussier');
  });

  it('valeurs nulles => neutre, pas de point', () => {
    const r = readIndicators({ rsi: null, macd: null, ma20: null, ma50: null });
    expect(r.tone).toBe('neutre');
    expect(r.points).toHaveLength(0);
  });
});
