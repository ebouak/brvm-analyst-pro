import { describe, it, expect } from 'vitest';
import { autorise, decisionReglages, resumer, issueVide, restantAujourdhui, debutJourUtc } from './passageSequences';

describe('autorise', () => {
  it('bon secret : oui', () => { expect(autorise('s'.repeat(40), `Bearer ${'s'.repeat(40)}`)).toBe(true); });
  it('sans en-tête, mauvais secret, en-tête vide : non', () => {
    expect(autorise('abc', null)).toBe(false);
    expect(autorise('abc', 'Bearer abd')).toBe(false);
    expect(autorise('abc', 'Bearer ')).toBe(false);
    expect(autorise('abc', 'Bearer abcd')).toBe(false);
  });
  it('secret absent ou vide côté serveur : non, même avec un en-tête', () => {
    expect(autorise(undefined, 'Bearer x')).toBe(false);
    expect(autorise('', 'Bearer ')).toBe(false);
    expect(autorise('', 'Bearer x')).toBe(false);
  });
});

describe('resumer', () => {
  const seq = (p: Partial<ReturnType<typeof issueVide>>) => ({ ...issueVide(), ...p });
  it('tout envoyé : 200, alerte', () => {
    const r = resumer({ a: seq({ envoye: 2 }), b: seq({ refus: 1 }) });
    expect(r).toMatchObject({ total: 3, http: 200, alerter: true });
  });
  it('un échec : 500', () => { expect(resumer({ a: seq({ envoye: 1, echec: 1 }) }).http).toBe(500); });
  it('un indisponible : 500 et alerte', () => { expect(resumer({ a: seq({ indisponible: 1 }) })).toMatchObject({ http: 500, alerter: true }); });
  it('rien ou seulement des refus/reportés : 200, pas d\'alerte', () => {
    expect(resumer({})).toMatchObject({ total: 0, http: 200, alerter: false });
    expect(resumer({ a: seq({ refus: 3, reporte: 2 }) })).toMatchObject({ http: 200, alerter: false });
  });
});

describe('plafond du jour', () => {
  it('restant', () => {
    expect(restantAujourdhui(20, 5)).toBe(15);
    expect(restantAujourdhui(20, 20)).toBe(0);
    expect(restantAujourdhui(20, 35)).toBe(0);
  });
  it('début du jour UTC', () => { expect(debutJourUtc(new Date('2026-11-02T23:59:00Z'))).toBe('2026-11-02T00:00:00.000Z'); });
});

describe('decisionReglages', () => {
  it('illisibles : inconnu (500 + alerte), jamais « off »', () => { expect(decisionReglages({ ok: false })).toBe('inconnu'); });
  it('off lu correctement : off ; autres modes : on poursuit', () => {
    expect(decisionReglages({ ok: true, mode: 'off' })).toBe('off');
    expect(decisionReglages({ ok: true, mode: 'simulation' })).toBe('poursuivre');
    expect(decisionReglages({ ok: true, mode: 'actif' })).toBe('poursuivre');
  });
});
