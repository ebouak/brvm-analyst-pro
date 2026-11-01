import { describe, it, expect } from 'vitest';
import { eligibilite } from './eligibilite';
import { REGLAGES_PAR_DEFAUT } from './reglages';
import type { Dossier, ActionCrm, Paiement } from './types';

const MAINT = new Date('2026-11-01T12:00:00Z');
const ilYa = (j: number) => new Date(MAINT.getTime() - j * 86_400_000).toISOString();
const d0: Dossier = {
  cle: 'u1', emailNorm: 'a@b.c', userId: 'u1', nom: 'Awa', inscritLe: null, derniereConnexion: null,
  premium: false, admin: false, oppose: false, paiementsEnAttente: [], paiementsReussis: [], paiements: [], offreVues: [],
  lignesPortefeuille: 0, messages: [], prospect: null, newsletter: false, leconsAcademy: 0, actions: [],
  whatsapp: { numero: null, source: null, lieSansNumero: false, recontact: false }, bonus: [],
};
const act = (a: Partial<ActionCrm> & Pick<ActionCrm, 'date'>): ActionCrm => ({
  type: 'relance', statut: 'envoye', canal: 'email', sujet: null, contenu: 'x', decision: null, motif: null, echeance: null, responsable: null, livraison: null, ...a,
});
const pay = (statut: Paiement['statut'], provider: string, jours: number): Paiement => ({ id: `p${jours}${statut}`, statut, provider, montant: 25000, devise: 'XOF', date: ilYa(jours), payeLe: statut === 'paid' ? ilYa(jours) : null });
const avec = (p: Partial<Dossier>): Dossier => ({ ...d0, ...p });
const R = REGLAGES_PAR_DEFAUT;

describe('eligibilite', () => {
  it('éligible : personne vierge', () => {
    expect(eligibilite(d0, R, MAINT)).toEqual({ ok: true, raisons: [] });
  });
  it('éligible : relances anciennes et sous le plafond', () => {
    expect(eligibilite(avec({ actions: [act({ date: ilYa(30) }), act({ date: ilYa(20) })] }), R, MAINT).ok).toBe(true);
  });
  it('refuse un paiement confirmé récent mais compte non Premium (à vérifier)', () => {
    const r = eligibilite(avec({ paiements: [pay('paid', 'manual', 3)] }), R, MAINT);
    expect(r.ok).toBe(false);
    expect(r.raisons).toEqual(["Paiement à vérifier d'abord dans Paiements."]);
  });
  it('refuse un paiement confirmé ancien devenu « payé » seulement si Premium ; sinon expiré = éligible', () => {
    expect(eligibilite(avec({ paiements: [pay('paid', 'manual', 90)] }), R, MAINT).ok).toBe(true);
  });
  it('refuse un paiement manuel en attente récent (à vérifier)', () => {
    expect(eligibilite(avec({ paiements: [pay('pending', 'manual', 2)] }), R, MAINT).raisons).toEqual(["Paiement à vérifier d'abord dans Paiements."]);
  });
  it('refuse Premium (une seule raison, pas de doublon avec « paiement confirmé »)', () => {
    expect(eligibilite(avec({ premium: true }), R, MAINT).raisons).toEqual(['Personne Premium ou administratrice : relance refusée.']);
  });
  it('refuse un administrateur', () => {
    expect(eligibilite(avec({ admin: true }), R, MAINT).raisons).toEqual(['Personne Premium ou administratrice : relance refusée.']);
  });
  it('refuse une personne opposée', () => {
    const r = eligibilite(avec({ oppose: true }), R, MAINT);
    expect(r.ok).toBe(false);
    expect(r.raisons[0]).toMatch(/opposée/);
  });
  it('refuse un dossier clôturé, accepte après réouverture', () => {
    const cloture = act({ date: ilYa(40), type: 'decision', statut: 'decision', canal: null, decision: 'cloture', motif: 'doublon' });
    expect(eligibilite(avec({ actions: [cloture] }), R, MAINT).raisons).toEqual(['Dossier clôturé : relance refusée.']);
    const reouv = act({ date: ilYa(35), type: 'decision', statut: 'decision', canal: null, decision: 'reouverture' });
    expect(eligibilite(avec({ actions: [cloture, reouv] }), R, MAINT).ok).toBe(true);
  });
  it('plafond : compte envoyées ET préparées, tous canaux, pas les échecs ni les notes', () => {
    const anciennes = [act({ date: ilYa(60) }), act({ date: ilYa(50), canal: 'whatsapp', statut: 'prepare' }), act({ date: ilYa(40) })];
    const r = eligibilite(avec({ actions: anciennes }), R, MAINT);
    expect(r.ok).toBe(false);
    expect(r.raisons[0]).toMatch(/3 relances.*maximum 3/);
    const avecEchec = [act({ date: ilYa(60) }), act({ date: ilYa(50), statut: 'echec' }), act({ date: ilYa(40), type: 'note', statut: 'note' })];
    expect(eligibilite(avec({ actions: avecEchec }), R, MAINT).ok).toBe(true);
  });
  it('plafond : une seule relance → « 1 relance » au singulier', () => {
    const r = eligibilite(avec({ actions: [act({ date: ilYa(40) })] }), { ...R, max_relances: 1 }, MAINT);
    expect(r.raisons[0]).toMatch(/1 relance \(/);
  });
  it('délai minimal : refuse sous le délai, accepte pile au délai', () => {
    const r = eligibilite(avec({ actions: [act({ date: ilYa(3) })] }), R, MAINT);
    expect(r.ok).toBe(false);
    expect(r.raisons[0]).toMatch(/il y a 3 jours.*7 jours/);
    expect(eligibilite(avec({ actions: [act({ date: ilYa(7) })] }), R, MAINT).ok).toBe(true);
    expect(eligibilite(avec({ actions: [act({ date: new Date(MAINT.getTime() - 7 * 86_400_000 + 1000).toISOString() })] }), R, MAINT).ok).toBe(false);
  });
  it('délai minimal : une relance WhatsApp préparée compte comme contact', () => {
    expect(eligibilite(avec({ actions: [act({ date: ilYa(1), canal: 'whatsapp', statut: 'prepare' })] }), R, MAINT).ok).toBe(false);
  });
  it('cumule les raisons', () => {
    const d = avec({ oppose: true, premium: true, actions: [act({ date: ilYa(1) })] });
    const r = eligibilite(d, R, MAINT);
    expect(r.ok).toBe(false);
    expect(r.raisons.length).toBe(3);
  });
  it('respecte les réglages fournis', () => {
    const d = avec({ actions: [act({ date: ilYa(3) })] });
    expect(eligibilite(d, { ...R, delai_min_jours: 2 }, MAINT).ok).toBe(true);
  });
});
