import { describe, expect, it } from 'vitest';
import { libelleSignal } from './signalLabel';
import { MIN_CONFIDENCE, scoreToRating } from './rating';

/* Audit de conformité, lot B (2026-11-11) : un libellé affiché ne doit jamais
   se lire comme une opération à passer. Les valeurs stockées (BUY/HOLD/SELL)
   ne changent pas. */
const VOCABULAIRE_INTERDIT = /\b(?:achat|vente|acheter|vendre|conserver|renforcer|all[ée]ger)\b/i;

describe('libelleSignal', () => {
  it('traduit les valeurs stockées en orientation des indicateurs', () => {
    expect(libelleSignal('BUY')).toBe('Signal haussier');
    expect(libelleSignal('HOLD')).toBe('Neutre');
    expect(libelleSignal('SELL')).toBe('Signal baissier');
  });

  it('garde le tiret pour une absence et la valeur brute pour un code inconnu', () => {
    expect(libelleSignal(null)).toBe('—');
    expect(libelleSignal(undefined)).toBe('—');
    expect(libelleSignal('XYZ')).toBe('XYZ');
  });

  it("n'emploie aucun verbe ou nom d'opération", () => {
    for (const s of ['BUY', 'HOLD', 'SELL']) expect(libelleSignal(s)).not.toMatch(VOCABULAIRE_INTERDIT);
  });
});

describe('scoreToRating — libellés', () => {
  const c = MIN_CONFIDENCE;
  it.each([
    [0.8, 'A+', 'Score très élevé'],
    [0.65, 'A', 'Score élevé'],
    [0.4, 'B+', 'Momentum positif'],
    [0.2, 'B', 'Légèrement positif'],
    [0, 'C', 'Neutre'],
    [-0.3, 'D', 'Momentum négatif'],
    [-0.8, 'E', 'Score faible'],
  ])('score %s → %s « %s »', (score, note, label) => {
    expect(scoreToRating(score, c)).toMatchObject({ note, label });
  });

  it("aucun libellé de l'échelle ne parle d'achat ou de vente", () => {
    for (const s of [1, 0.75, 0.6, 0.3, 0.1, 0, -0.1, -0.6, -1]) {
      expect(scoreToRating(s, c).label).not.toMatch(VOCABULAIRE_INTERDIT);
    }
    expect(scoreToRating(null, null).label).toBe('Non noté');
  });
});
