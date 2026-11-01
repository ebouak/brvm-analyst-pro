import { describe, it, expect } from 'vitest';
import { calculerIndicateurs, PERIODE_CONVERSION_JOURS } from './indicateurs';
import { REGLAGES_PAR_DEFAUT } from './reglages';
import type { Dossier, ActionCrm, Paiement } from './types';

const MAINT = new Date('2026-11-01T12:00:00Z');
const ilYa = (j: number) => new Date(MAINT.getTime() - j * 86_400_000).toISOString();
const R = REGLAGES_PAR_DEFAUT;
let n = 0;
const d0: Dossier = {
  cle: 'u0', emailNorm: 'a@b.c', userId: 'u0', nom: null, inscritLe: null, derniereConnexion: null,
  premium: false, admin: false, oppose: false, paiementsEnAttente: [], paiementsReussis: [], paiements: [], offreVues: [],
  lignesPortefeuille: 0, messages: [], prospect: null, newsletter: false, leconsAcademy: 0, actions: [],
  whatsapp: { numero: null, source: null, lieSansNumero: false, recontact: false }, bonus: [],
};
const dos = (p: Partial<Dossier> = {}): Dossier => { n++; return { ...d0, cle: `u${n}`, emailNorm: `u${n}@x.y`, userId: `u${n}`, ...p }; };
const act = (a: Partial<ActionCrm> & Pick<ActionCrm, 'date'>): ActionCrm => ({
  type: 'relance', statut: 'envoye', canal: 'email', sujet: null, contenu: 'x', decision: null, motif: null, echeance: null, responsable: null, ...a,
});
const pay = (statut: Paiement['statut'], provider: string, jours: number, montant = 25000, devise = 'XOF'): Paiement => ({
  id: `p${++n}`, statut, provider, montant, devise, date: ilYa(jours), payeLe: statut === 'paid' ? ilYa(jours) : null,
});
const calc = (ds: Dossier[], r = R) => calculerIndicateurs(ds, r, MAINT);

describe('calculerIndicateurs', () => {
  it('liste vide : zéros', () => {
    expect(calc([])).toEqual({
      aTraiter: 0, ouvertes: 0, montantPotentiel: { total: 0, devise: 'XOF', sansMontant: 0, autresDevises: 0 },
      conversions: { relances: 0, converties: 0, fenetreJours: 30, periodeJours: PERIODE_CONVERSION_JOURS },
    });
  });
  it('à traiter : silence au-delà du délai de suivi ; en attente et jamais contactés ne comptent pas', () => {
    const silence = dos({ actions: [act({ date: ilYa(10) })] });
    const recent = dos({ actions: [act({ date: ilYa(2) })] });
    const vierge = dos();
    const r = calc([silence, recent, vierge]);
    expect(r.aTraiter).toBe(1);
    expect(r.ouvertes).toBe(3);
  });
  it('ouvertes : exclut convertis et clôturés ; ignore les administrateurs', () => {
    const premium = dos({ premium: true });
    const oppose = dos({ oppose: true });
    const admin = dos({ admin: true });
    const ouvert = dos();
    const r = calc([premium, oppose, admin, ouvert]);
    expect(r.ouvertes).toBe(1);
  });
  it('une même personne présente deux fois n\'est comptée qu\'une fois', () => {
    const a = dos({ actions: [act({ date: ilYa(10) })] });
    const r = calc([a, { ...a }]);
    expect(r.aTraiter).toBe(1);
    expect(r.ouvertes).toBe(1);
  });
  it('montant potentiel : somme des intentions en cours, FCFA uniquement ; reste compté « sans montant »', () => {
    const a = dos({ paiements: [pay('pending', 'manual', 2, 25000)] });
    const b = dos({ paiements: [pay('pending', 'cinetpay', 40, 10000, 'FCFA')] });
    const c = dos({ paiements: [pay('pending', 'manual', 3, 50, 'EUR')] });
    const e = dos();
    const clos = dos({ oppose: true, paiements: [pay('pending', 'manual', 2, 99999)] });
    const r = calc([a, b, c, e, clos]);
    expect(r.montantPotentiel).toEqual({ total: 35000, devise: 'XOF', sansMontant: 2, autresDevises: 1 });
    expect(r.ouvertes).toBe(4);
  });
  it('montant potentiel : une intention supplantée par un paiement ultérieur n\'est pas comptée', () => {
    const p = dos({ paiements: [pay('pending', 'manual', 20, 25000), pay('paid', 'manual', 10, 25000)], premium: true });
    expect(calc([p]).montantPotentiel.total).toBe(0);
  });
  describe('conversions', () => {
    it('numérateur : paid dans la fenêtre après la PREMIÈRE relance ; plusieurs tentatives ne doublent pas', () => {
      const converti = dos({ actions: [act({ date: ilYa(40) }), act({ date: ilYa(20) }), act({ date: ilYa(10), canal: 'whatsapp', statut: 'prepare' })], paiements: [pay('paid', 'manual', 25)], premium: true });
      const non = dos({ actions: [act({ date: ilYa(40) })] });
      expect(calc([converti, non]).conversions).toEqual({ relances: 2, converties: 1, fenetreJours: 30, periodeJours: 90 });
    });
    it('un paiement antérieur à la première relance ne compte pas', () => {
      const avant = dos({ actions: [act({ date: ilYa(20) })], paiements: [pay('paid', 'manual', 30)] });
      expect(calc([avant]).conversions.converties).toBe(0);
    });
    it('bornes de la fenêtre : inclusive à fenetre_conversion_jours, exclue au-delà', () => {
      const dedans = dos({ actions: [act({ date: ilYa(60) })], paiements: [pay('paid', 'manual', 30)] });
      const dehors = dos({ actions: [act({ date: ilYa(61) })], paiements: [pay('paid', 'manual', 30)] });
      expect(calc([dedans]).conversions.converties).toBe(1);
      expect(calc([dehors]).conversions.converties).toBe(0);
    });
    it('bornes de la période : première relance à 90 jours incluse, au-delà exclue', () => {
      const pile = dos({ actions: [act({ date: ilYa(90) })] });
      const trop = dos({ actions: [act({ date: ilYa(91) })] });
      expect(calc([pile]).conversions.relances).toBe(1);
      expect(calc([trop]).conversions.relances).toBe(0);
    });
    it('une relance échouée ou une note ne compte pas ; une relance préparée si', () => {
      const echec = dos({ actions: [act({ date: ilYa(5), statut: 'echec' }), act({ date: ilYa(4), type: 'note', statut: 'note' })] });
      const prepare = dos({ actions: [act({ date: ilYa(5), statut: 'prepare', canal: 'whatsapp' })] });
      expect(calc([echec, prepare]).conversions.relances).toBe(1);
    });
    it('respecte une fenêtre réglée autrement', () => {
      const d = dos({ actions: [act({ date: ilYa(40) })], paiements: [pay('paid', 'manual', 5)] });
      expect(calc([d], { ...R, fenetre_conversion_jours: 30 }).conversions.converties).toBe(0);
      expect(calc([d], { ...R, fenetre_conversion_jours: 45 }).conversions).toMatchObject({ converties: 1, fenetreJours: 45 });
    });
  });
});
