import { describe, it, expect } from 'vitest';
import { describeAlert, type AlertRow } from '../src/alerts/runAlerts.js';

const alerte = (type: AlertRow['type'], seuil: number | null): AlertRow => ({
  id: 'a', user_id: 'u', code: 'SNTS', type, seuil, actif: true, declenchee_le: null,
});
const px = { cours: 25500, variation: 2.5 };
const smart = { signal: null, rsi: 82.4, daysToExDividend: 1 };

// Les espaces de groupement fr-FR (insécables) sont normalisés pour la lisibilité.
const lire = (s: string) => s.replace(/[  ]/g, ' ');

describe('describeAlert — libellés envoyés aux utilisateurs', () => {
  it('prix : seuil et cours à la française, avec l’unité', () => {
    expect(lire(describeAlert(alerte('prix_au_dessus', 25000), px, smart)))
      .toBe('SNTS a atteint ou dépassé 25 000 FCFA (cours : 25 500 FCFA).');
  });

  it('variation : virgule décimale et espace avant %', () => {
    expect(lire(describeAlert(alerte('variation', 2), { cours: 25500, variation: 2.53 }, smart)))
      .toBe('SNTS a varié de 2,53 % sur la séance (seuil : 2 %).');
  });

  it('RSI : la valeur et sa zone, sans pronostic', () => {
    const t = describeAlert(alerte('rsi_surachat', null), px, smart);
    expect(t).toBe('SNTS : RSI à 82, en zone dite de surachat.');
    expect(t).not.toMatch(/prudence|rebond/i);
  });

  it('dividende : accord du pluriel, et date absente dite absente', () => {
    expect(describeAlert(alerte('dividende_proche', null), px, smart)).toBe('SNTS : détachement de dividende dans 1 jour.');
    expect(describeAlert(alerte('dividende_proche', null), px, { ...smart, daysToExDividend: 3 })).toContain('dans 3 jours.');
    expect(describeAlert(alerte('dividende_proche', null), px, { ...smart, daysToExDividend: null })).toContain('date non disponible');
  });

  it('une valeur absente devient « non disponible », jamais « ? »', () => {
    const t = describeAlert(alerte('prix_en_dessous', 20000), { cours: null, variation: null }, smart);
    expect(t).toContain('non disponible');
    expect(t).not.toContain('?');
  });

  it('signal : en français, sans majuscules criardes', () => {
    expect(describeAlert(alerte('signal_achat', null), px, smart)).toBe('SNTS : le signal technique passe à « achat ».');
  });
});
