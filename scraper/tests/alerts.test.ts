import { describe, it, expect } from 'vitest';
import { isTriggered, isSmartTriggered, isSmartType } from '../src/alerts/evaluate.js';

describe('isTriggered', () => {
  it('prix_au_dessus', () => {
    expect(isTriggered({ type: 'prix_au_dessus', seuil: 100 }, 105, null)).toBe(true);
    expect(isTriggered({ type: 'prix_au_dessus', seuil: 100 }, 95, null)).toBe(false);
    expect(isTriggered({ type: 'prix_au_dessus', seuil: 100 }, null, null)).toBe(false);
  });
  it('prix_en_dessous', () => {
    expect(isTriggered({ type: 'prix_en_dessous', seuil: 100 }, 95, null)).toBe(true);
    expect(isTriggered({ type: 'prix_en_dessous', seuil: 100 }, 105, null)).toBe(false);
  });
  it('variation (valeur absolue)', () => {
    expect(isTriggered({ type: 'variation', seuil: 5 }, null, -6)).toBe(true);
    expect(isTriggered({ type: 'variation', seuil: 5 }, null, 3)).toBe(false);
  });
  it('seuil null => pas de déclenchement', () => {
    expect(isTriggered({ type: 'prix_au_dessus', seuil: null }, 105, null)).toBe(false);
  });
});

describe('isSmartTriggered', () => {
  const ctx = (o: Partial<{ signal: 'BUY' | 'HOLD' | 'SELL' | null; rsi: number | null; daysToExDividend: number | null }>) =>
    ({ signal: null, rsi: null, daysToExDividend: null, ...o });

  it('signal achat / vente', () => {
    expect(isSmartTriggered({ type: 'signal_achat', seuil: null }, ctx({ signal: 'BUY' }))).toBe(true);
    expect(isSmartTriggered({ type: 'signal_achat', seuil: null }, ctx({ signal: 'HOLD' }))).toBe(false);
    expect(isSmartTriggered({ type: 'signal_vente', seuil: null }, ctx({ signal: 'SELL' }))).toBe(true);
  });
  it('RSI survente/surachat avec défauts', () => {
    expect(isSmartTriggered({ type: 'rsi_survente', seuil: null }, ctx({ rsi: 25 }))).toBe(true);
    expect(isSmartTriggered({ type: 'rsi_survente', seuil: null }, ctx({ rsi: 35 }))).toBe(false);
    expect(isSmartTriggered({ type: 'rsi_surachat', seuil: null }, ctx({ rsi: 75 }))).toBe(true);
    expect(isSmartTriggered({ type: 'rsi_survente', seuil: 40 }, ctx({ rsi: 35 }))).toBe(true); // seuil custom
  });
  it('dividende proche (fenêtre)', () => {
    expect(isSmartTriggered({ type: 'dividende_proche', seuil: null }, ctx({ daysToExDividend: 5 }))).toBe(true);
    expect(isSmartTriggered({ type: 'dividende_proche', seuil: null }, ctx({ daysToExDividend: 10 }))).toBe(false);
    expect(isSmartTriggered({ type: 'dividende_proche', seuil: null }, ctx({ daysToExDividend: null }))).toBe(false);
  });
  it('isSmartType', () => {
    expect(isSmartType('signal_achat')).toBe(true);
    expect(isSmartType('prix_au_dessus')).toBe(false);
  });
});
