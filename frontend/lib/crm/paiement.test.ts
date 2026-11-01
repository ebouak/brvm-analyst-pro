import { describe, it, expect } from 'vitest';
import { etatPaiement, JOURS_VERIF, JOURS_PAYE } from './paiement';
import type { Paiement } from './types';

const MAINT = new Date('2026-11-01T12:00:00Z');
const ilYa = (j: number) => new Date(MAINT.getTime() - j * 86_400_000).toISOString();
const p = (id: string, statut: Paiement['statut'], provider: string, jours: number, montant = 25000): Paiement => ({
  id, statut, provider, montant, devise: 'XOF', date: ilYa(jours), payeLe: statut === 'paid' ? ilYa(jours) : null,
});
const d = (paiements: Paiement[], premium = false) => ({ premium, paiements });

describe('etatPaiement', () => {
  it('constantes', () => { expect(JOURS_VERIF).toBe(30); expect(JOURS_PAYE).toBe(35); });

  it('aucun paiement', () => {
    expect(etatPaiement(d([]), MAINT)).toMatchObject({ etat: 'aucun', doublons: [], enCours: null });
  });

  it('premium => payé, même sans paiement', () => {
    expect(etatPaiement(d([], true), MAINT).etat).toBe('paye');
  });

  it('cas de production : Premium + paid chariow + ancienne intention manuelle => payé, doublon écarté', () => {
    const r = etatPaiement(d([p('m1', 'pending', 'manual', 20), p('c1', 'paid', 'chariow', 10)], true), MAINT);
    expect(r.etat).toBe('paye');
    expect(r.doublons).toEqual(['m1']);
    expect(r.enCours).toBeNull();
  });

  it('paid récent mais pas Premium => à vérifier (contradiction annoncée)', () => {
    const r = etatPaiement(d([p('c1', 'paid', 'chariow', 10)]), MAINT);
    expect(r.etat).toBe('a_verifier');
    expect(r.detail).toContain('contradiction');
  });

  it('paid : 34 jours => contradiction, 35 jours => expiré', () => {
    expect(etatPaiement(d([p('c1', 'paid', 'chariow', 34)]), MAINT).etat).toBe('a_verifier');
    expect(etatPaiement(d([p('c1', 'paid', 'chariow', 35)]), MAINT).etat).toBe('expire');
  });

  it('intention manuelle récente non supplantée => à vérifier, avec montant concerné', () => {
    const r = etatPaiement(d([p('m1', 'pending', 'manual', 7, 100000)]), MAINT);
    expect(r.etat).toBe('a_verifier');
    expect(r.enCours).toMatchObject({ montant: 100000, provider: 'manual' });
    expect(r.detail).toContain('100 000 FCFA');
  });

  it('manuel : 29 jours => à vérifier ; 30 jours pile => abandonné', () => {
    expect(etatPaiement(d([p('m1', 'pending', 'manual', 29)]), MAINT).etat).toBe('a_verifier');
    expect(etatPaiement(d([p('m1', 'pending', 'manual', 30)]), MAINT).etat).toBe('abandonne');
  });

  it('intention en ligne non supplantée => abandonné', () => {
    const r = etatPaiement(d([p('c1', 'pending', 'chariow', 2)]), MAINT);
    expect(r.etat).toBe('abandonne');
    expect(r.enCours).toMatchObject({ provider: 'chariow' });
  });

  it('échec récent sans paid => abandonné ; échec ancien => aucun', () => {
    expect(etatPaiement(d([p('f1', 'failed', 'chariow', 5)]), MAINT).etat).toBe('abandonne');
    expect(etatPaiement(d([p('f1', 'failed', 'chariow', 30)]), MAINT).etat).toBe('aucun');
  });

  it('ancien paid, non Premium, rien en cours => expiré', () => {
    expect(etatPaiement(d([p('c1', 'paid', 'chariow', 90)]), MAINT)).toMatchObject({ etat: 'expire', enCours: null });
  });

  it("intention postérieure à un ancien paid => suit l'intention", () => {
    const r = etatPaiement(d([p('c1', 'paid', 'chariow', 90), p('m1', 'pending', 'manual', 3)]), MAINT);
    expect(r.etat).toBe('a_verifier');
    expect(r.doublons).toEqual([]);
  });

  it('intention antérieure à un ancien paid : doublon, état expiré', () => {
    const r = etatPaiement(d([p('m0', 'pending', 'manual', 100), p('c1', 'paid', 'chariow', 90)]), MAINT);
    expect(r.etat).toBe('expire');
    expect(r.doublons).toEqual(['m0']);
  });

  it('plusieurs intentions : la plus récente est le montant concerné', () => {
    const r = etatPaiement(d([p('m1', 'pending', 'manual', 20, 10000), p('m2', 'pending', 'manual', 5, 50000)]), MAINT);
    expect(r.enCours?.montant).toBe(50000);
  });

  it('le détail ne cite que des faits (montant et date)', () => {
    const r = etatPaiement(d([p('m1', 'pending', 'manual', 7, 25000)]), MAINT);
    expect(r.detail).toBe('Paiement manuel de 25 000 FCFA le 25/10, non confirmé : la personne a peut-être payé.');
  });
});
