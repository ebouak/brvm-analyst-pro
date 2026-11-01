import { describe, it, expect } from 'vitest';
import { etatJeton, pdfFrais, estCodeValeur, VALIDITE_JOURS } from './jetonBonus';

const M = new Date('2026-11-15T12:00:00Z');

describe('etatJeton', () => {
  it('inconnu sans ligne', () => expect(etatJeton(null, M)).toBe('inconnu'));
  it('valide dans la fenêtre', () => expect(etatJeton({ created_at: '2026-11-10T08:00:00Z', bonus_at: null }, M)).toBe('valide'));
  it('utilisé dès que bonus_at est posé', () => expect(etatJeton({ created_at: '2026-11-14T08:00:00Z', bonus_at: '2026-11-14T09:00:00Z' }, M)).toBe('utilise'));
  it('expiré au-delà de 14 jours', () => {
    expect(VALIDITE_JOURS).toBe(14);
    expect(etatJeton({ created_at: '2026-10-31T11:59:00Z', bonus_at: null }, M)).toBe('expire');
  });
  it('date illisible = expiré (échec fermé)', () => expect(etatJeton({ created_at: 'n/a', bonus_at: null }, M)).toBe('expire'));
});

describe('pdfFrais', () => {
  it('frais à moins de 3 jours', () => expect(pdfFrais('2026-11-13T06:00:00Z', M)).toBe(true));
  it('périmé au-delà de 3 jours', () => expect(pdfFrais('2026-11-12T06:00:00Z', M)).toBe(false));
  it('absent = périmé', () => expect(pdfFrais(null, M)).toBe(false));
});

describe('estCodeValeur', () => {
  it('accepte SNTS, refuse le reste', () => {
    expect(estCodeValeur('SNTS')).toBe(true);
    for (const c of ['snts', 'S', 'SNTS/../X', 'ABCDEFGHI']) expect(estCodeValeur(c)).toBe(false);
  });
});
