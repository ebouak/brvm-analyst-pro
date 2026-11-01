import { describe, it, expect } from 'vitest';
import { etapesDues, selectionnerPassage, etapesFaites } from './sequences';
import { REGLAGES_PAR_DEFAUT } from './reglages';
import type { Dossier, ActionCrm, Paiement } from './types';

const MAINT = new Date('2026-11-01T09:00:00Z');
const ilYa = (j: number, h = 0) => new Date(MAINT.getTime() - j * 86_400_000 - h * 3_600_000).toISOString();
const d0: Dossier = {
  cle: 'u1', emailNorm: 'a@b.c', userId: 'u1', nom: 'Awa', inscritLe: null, derniereConnexion: null,
  premium: false, admin: false, oppose: false, paiementsEnAttente: [], paiementsReussis: [], paiements: [], offreVues: [], formationVues: [], pays: null,
  lignesPortefeuille: 0, messages: [], prospect: null, newsletter: false, leconsAcademy: 0, actions: [],
  whatsapp: { numero: null, source: null, lieSansNumero: false, recontact: false }, bonus: [],
};
const avec = (p: Partial<Dossier>): Dossier => ({ ...d0, ...p });
const act = (a: Partial<ActionCrm> & Pick<ActionCrm, 'date'>): ActionCrm => ({
  type: 'relance', statut: 'envoye', canal: 'email', sujet: null, contenu: 'x', decision: null, motif: null, echeance: null, responsable: null, livraison: null, ...a,
});
const pay = (statut: Paiement['statut'], provider: string, jours: number, id = `p${jours}${statut}`): Paiement => ({ id, statut, provider, montant: 25000, devise: 'XOF', date: ilYa(jours), payeLe: statut === 'paid' ? ilYa(jours) : null });
// Paiement en ligne non abouti (« abandonné » : pas manuel).
const abandon = (jours: number) => avec({ paiements: [pay('pending', 'cinetpay', jours)] });
const vue = (jours: number) => ({ page: '/offre', jour: ilYa(jours).slice(0, 10) });
const R = { ...REGLAGES_PAR_DEFAUT, delai_min_jours: 1 };
const dues = (d: Dossier, faites: string[] = [], r = R, m = MAINT) => etapesDues(d, r, m, new Set(faites));

describe('paiement_inacheve', () => {
  it('rien avant J+1, due à J+1 pile', () => {
    expect(dues(abandon(0))).toEqual([]);
    const p = { ...pay('pending', 'cinetpay', 0), date: '2026-10-31T09:00:00.000Z' };
    expect(etapesDues(avec({ paiements: [p] }), R, MAINT, new Set())[0]?.cle).toBe('paiement_inacheve:1');
    expect(etapesDues(avec({ paiements: [p] }), R, new Date('2026-11-01T08:59:59Z'), new Set())).toEqual([]);
  });
  it('étape 1 faite : étape 2 seulement à J+8', () => {
    expect(dues(abandon(7), ['paiement_inacheve:1'])).toEqual([]);
    expect(dues(abandon(8), ['paiement_inacheve:1'])[0].cle).toBe('paiement_inacheve:2');
  });
  it('réglages par défaut : étape 1 envoyée à J+1, étape 2 due à J+8 (délai minimal de 7 jours respecté)', () => {
    const d = (j: number) => avec({ ...abandon(j), actions: [act({ date: ilYa(j - 1), sequenceCle: 'paiement_inacheve:1' })] });
    const faites = (x: Dossier) => etapesFaites(x);
    expect(etapesDues(d(4), REGLAGES_PAR_DEFAUT, MAINT, faites(d(4)))).toEqual([]);
    expect(etapesDues(d(7), REGLAGES_PAR_DEFAUT, MAINT, faites(d(7)))).toEqual([]);
    expect(etapesDues(d(8), REGLAGES_PAR_DEFAUT, MAINT, faites(d(8)))[0]?.cle).toBe('paiement_inacheve:2');
  });
  it("une seule étape par passage : à J+5 sans rien fait, l'étape 1 d'abord", () => {
    const r = dues(abandon(5));
    expect(r).toHaveLength(1);
    expect(r[0].cle).toBe('paiement_inacheve:1');
  });
  it('étape déjà faite (même en simulation ou en échec) : sautée, jamais rejouée', () => {
    const d = avec({ ...abandon(2), actions: [act({ date: ilYa(1), statut: 'echec', sequenceCle: 'paiement_inacheve:1' })] });
    expect(dues(d, [...etapesFaites(d)])).toEqual([]);
    expect(etapesFaites(avec({ actions: [act({ date: ilYa(1), statut: 'simulation', sequenceCle: 'paiement_inacheve:1' })] })).has('paiement_inacheve:1')).toBe(true);
  });
  it('toutes les étapes faites : rien', () => {
    expect(dues(abandon(10), ['paiement_inacheve:1', 'paiement_inacheve:2'])).toEqual([]);
  });
  it('paiement à vérifier (manuel récent) : jamais relancé', () => {
    expect(dues(avec({ paiements: [pay('pending', 'manual', 3)] }))).toEqual([]);
  });
  it('ancre de plus de 30 jours : cas ancien, rien', () => {
    expect(dues(abandon(31))).toEqual([]);
  });
});

describe('offre_consultee', () => {
  it('due à J+2 après la dernière visite (fin de journée), pas avant', () => {
    expect(dues(avec({ offreVues: [vue(2)] }))).toEqual([]);
    expect(dues(avec({ offreVues: [vue(3)] }))[0]).toMatchObject({ cle: 'offre_consultee:1', templateId: 'offre_consultee' });
  });
  it('ancrée sur la visite la plus récente', () => {
    expect(dues(avec({ offreVues: [vue(10), vue(1)] }))).toEqual([]);
  });
  it('pas si un paiement est en cours de vérification', () => {
    expect(dues(avec({ offreVues: [vue(4)], paiements: [pay('pending', 'manual', 2)] }))).toEqual([]);
  });
  it('visite de plus de 30 jours : rien', () => {
    expect(dues(avec({ offreVues: [vue(40)] }))).toEqual([]);
  });
  it('ancien paiement expiré : relancée', () => {
    expect(dues(avec({ offreVues: [vue(3)], paiements: [pay('paid', 'manual', 90)] }))).toHaveLength(1);
  });
});

describe('garde-fous', () => {
  it('base : éligible', () => { expect(dues(abandon(2))).toHaveLength(1); });
  it('plafond de relances atteint : rien', () => {
    const d = avec({ ...abandon(2), actions: [act({ date: ilYa(20) }), act({ date: ilYa(19) }), act({ date: ilYa(18) })] });
    expect(dues(d)).toEqual([]);
  });
  it('délai minimal non écoulé : rien', () => {
    expect(dues(avec({ ...abandon(2), actions: [act({ date: ilYa(1) })] }), [], REGLAGES_PAR_DEFAUT)).toEqual([]);
  });
  it('opposé, admin, premium : rien', () => {
    expect(dues(avec({ ...abandon(2), oppose: true }))).toEqual([]);
    expect(dues(avec({ ...abandon(2), admin: true }))).toEqual([]);
    expect(dues(avec({ ...abandon(2), premium: true }))).toEqual([]);
  });
  it('dossier clôturé : rien ; rouvert : de nouveau possible', () => {
    const cl = act({ date: ilYa(1), type: 'decision', statut: 'decision', decision: 'cloture', motif: 'pas_interesse' });
    expect(dues(avec({ ...abandon(2), actions: [cl] }))).toEqual([]);
    const ro = act({ date: ilYa(0, 5), type: 'decision', statut: 'decision', decision: 'reouverture' });
    expect(dues(avec({ ...abandon(2), actions: [cl, ro] }))).toHaveLength(1);
  });
  it("réponse reçue après l'ancre : arrêt", () => {
    expect(dues(avec({ ...abandon(3), messages: [{ date: ilYa(1) }] }))).toEqual([]);
    expect(dues(avec({ ...abandon(3), messages: [{ date: ilYa(5) }] }))).toHaveLength(1);
  });
  it('réponse déclarée, même ensuite « traitée » : la séquence reste arrêtée', () => {
    const rep = act({ date: ilYa(2), type: 'decision', statut: 'decision', decision: 'reponse' });
    expect(dues(avec({ ...abandon(3), actions: [rep] }))).toEqual([]);
    const tr = act({ date: ilYa(1), type: 'decision', statut: 'decision', decision: 'traite' });
    expect(dues(avec({ ...abandon(3), actions: [rep, tr] }))).toEqual([]);
  });
  it("étape 2 : seulement si l'étape 1 est réellement partie (échec ou « envoi » indéterminé = arrêt)", () => {
    const ok = act({ date: ilYa(8), statut: 'envoye', sequenceCle: 'paiement_inacheve:1' });
    const dOk = avec({ ...abandon(9), actions: [ok] });
    expect(selectionnerPassage([dOk], { ...REGLAGES_PAR_DEFAUT, mode_sequences: 'actif' }, MAINT).map((x) => x.etape.cle)).toEqual(['paiement_inacheve:2']);
    for (const statut of ['echec', 'envoi']) {
      const d = avec({ ...abandon(9), actions: [act({ date: ilYa(8), statut, sequenceCle: 'paiement_inacheve:1' })] });
      expect(selectionnerPassage([d], { ...REGLAGES_PAR_DEFAUT, mode_sequences: 'actif' }, MAINT)).toEqual([]);
    }
  });
  it("étape 1 rejetée ou signalée spam : pas d'étape 2", () => {
    for (const livraison of ['rejete', 'spam'] as const) {
      const d = avec({ ...abandon(9), actions: [act({ date: ilYa(8), statut: 'envoye', livraison, sequenceCle: 'paiement_inacheve:1' })] });
      expect(selectionnerPassage([d], { ...REGLAGES_PAR_DEFAUT, mode_sequences: 'actif' }, MAINT)).toEqual([]);
    }
    const remis = avec({ ...abandon(9), actions: [act({ date: ilYa(8), statut: 'envoye', livraison: 'remis', sequenceCle: 'paiement_inacheve:1' })] });
    expect(selectionnerPassage([remis], { ...REGLAGES_PAR_DEFAUT, mode_sequences: 'actif' }, MAINT)).toHaveLength(1);
  });
  it("simulation : l'étape 2 suit une étape 1 simulée", () => {
    const d = avec({ ...abandon(9), actions: [act({ date: ilYa(8), statut: 'simulation', sequenceCle: 'sim_paiement_inacheve:1' })] });
    expect(selectionnerPassage([d], { ...REGLAGES_PAR_DEFAUT, mode_sequences: 'simulation' }, MAINT).map((x) => x.etape.cle)).toEqual(['paiement_inacheve:2']);
  });
  it("paiement abandonné + offre vue : seule la séquence de paiement s'applique", () => {
    const d = avec({ paiements: [pay('pending', 'cinetpay', 6)], offreVues: [vue(3)] });
    expect(dues(d)).toHaveLength(1);
    expect(dues(d)[0].cle).toBe('paiement_inacheve:1');
    expect(dues(d, ['paiement_inacheve:1', 'paiement_inacheve:2'])).toEqual([]);
  });
});

describe('simulation et mode actif', () => {
  const sim = (cle: string) => act({ date: ilYa(1), statut: 'simulation', sequenceCle: `sim_${cle}` });
  const reel = (cle: string) => act({ date: ilYa(1), sequenceCle: cle });
  const cas = (actions: ActionCrm[]) => avec({ cle: 'u9', emailNorm: 'z@x.fr', userId: 'u9', paiements: [pay('pending', 'cinetpay', 2, 'z')], actions });
  const passer = (d: Dossier, mode: 'simulation' | 'actif') => selectionnerPassage([d], { ...R, mode_sequences: mode }, MAINT);
  it("simulation puis actif : l'étape simulée est due pour de vrai", () => {
    const d = cas([sim('paiement_inacheve:1')]);
    expect(passer(d, 'actif').map((x) => x.etape.cle)).toEqual(['paiement_inacheve:1']);
  });
  it('simulation deux fois : une seule simulation', () => {
    expect(passer(cas([]), 'simulation')).toHaveLength(1);
    expect(passer(cas([sim('paiement_inacheve:1')]), 'simulation')).toEqual([]);
  });
  it('actif deux fois : une seule étape réelle', () => {
    expect(passer(cas([]), 'actif')).toHaveLength(1);
    expect(passer(cas([reel('paiement_inacheve:1')]), 'actif')).toEqual([]);
  });
  it('une étape réelle ne bloque pas la simulation, et inversement', () => {
    expect(etapesFaites(cas([reel('paiement_inacheve:1')]), true).size).toBe(0);
    expect(etapesFaites(cas([sim('paiement_inacheve:1')]), false).size).toBe(0);
  });
});

describe('selectionnerPassage', () => {
  const mk = (i: number, jours: number) => avec({ cle: `u${i}`, emailNorm: `p${i}@x.fr`, userId: `u${i}`, paiements: [pay('pending', 'cinetpay', jours, `x${i}`)] });
  it("plafonné et trié par ancre, la plus ancienne d'abord", () => {
    const r = selectionnerPassage([mk(1, 2), mk(2, 9), mk(3, 5), mk(4, 7)], { ...R, plafond_par_execution: 2 }, MAINT);
    expect(r.map((x) => x.cle)).toEqual(['u2', 'u4']);
  });
  it('exclut admins et personnes sans étape due', () => {
    const r = selectionnerPassage([avec({ ...abandon(3), admin: true }), mk(2, 0), mk(3, 3)], R, MAINT);
    expect(r.map((x) => x.cle)).toEqual(['u3']);
  });
  it("une adresse n'apparaît qu'une fois", () => {
    const a = mk(1, 3); const b = { ...mk(2, 4), emailNorm: a.emailNorm };
    expect(selectionnerPassage([a, b], R, MAINT)).toHaveLength(1);
  });
  it('liste vide : rien', () => {
    expect(selectionnerPassage([], R, MAINT)).toEqual([]);
  });
});
