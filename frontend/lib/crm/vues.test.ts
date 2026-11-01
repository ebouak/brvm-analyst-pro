import { describe, it, expect } from 'vitest';
import { vueDe, actionRecommandee, decisionsCourantes, dernierContact, reponseRecue, VUES, LIB_VUE, REGLAGES_DEFAUT } from './vues';
import { etatPaiement } from './paiement';
import type { Dossier, ActionCrm, Paiement } from './types';

const MAINT = new Date('2026-11-01T12:00:00Z');
const ilYa = (j: number) => new Date(MAINT.getTime() - j * 86_400_000).toISOString();
const jourDans = (j: number) => new Date(MAINT.getTime() + j * 86_400_000).toISOString().slice(0, 10);

const d0: Dossier = {
  cle: 'u1', emailNorm: 'a@b.c', userId: 'u1', nom: 'Awa', inscritLe: null, derniereConnexion: null,
  premium: false, admin: false, oppose: false, paiementsEnAttente: [], paiementsReussis: [], paiements: [], offreVues: [],
  lignesPortefeuille: 0, messages: [], prospect: null, newsletter: false, leconsAcademy: 0, actions: [],
  whatsapp: { numero: null, source: null, lieSansNumero: false, recontact: false }, bonus: [],
};
const act = (a: Partial<ActionCrm> & Pick<ActionCrm, 'date'>): ActionCrm => ({
  type: 'relance', statut: 'envoye', canal: 'email', sujet: null, contenu: 'x', decision: null, motif: null, echeance: null, responsable: null, ...a,
});
const relance = (jours: number, statut = 'envoye') => act({ date: ilYa(jours), statut });
const decision = (jours: number, decision: ActionCrm['decision'], extra: Partial<ActionCrm> = {}) =>
  act({ date: ilYa(jours), type: 'decision', statut: 'decision', canal: null, decision, ...extra });
const pay = (id: string, statut: Paiement['statut'], provider: string, jours: number, montant = 25000): Paiement => ({
  id, statut, provider, montant, devise: 'XOF', date: ilYa(jours), payeLe: statut === 'paid' ? ilYa(jours) : null,
});
const avec = (p: Partial<Dossier>): Dossier => ({ ...d0, ...p });

describe('decisionsCourantes', () => {
  it('la plus récente de chaque nature l\'emporte', () => {
    const r = decisionsCourantes(avec({ actions: [
      decision(10, 'echeance', { echeance: '2026-11-05' }), decision(2, 'echeance', { echeance: '2026-11-20' }),
      decision(9, 'responsable', { responsable: 'r1' }), decision(3, 'responsable', { responsable: 'r2' }),
      decision(8, 'reponse'), decision(4, 'reponse'),
    ] }));
    expect(r).toMatchObject({ echeance: '2026-11-20', responsable: 'r2', derniereReponse: ilYa(4), cloture: null });
  });
  it('une réouverture postérieure annule la clôture ; une clôture postérieure la rétablit', () => {
    const c = decision(10, 'cloture', { motif: 'doublon' });
    expect(decisionsCourantes(avec({ actions: [c, decision(5, 'reouverture')] })).cloture).toBeNull();
    expect(decisionsCourantes(avec({ actions: [c, decision(5, 'reouverture'), decision(1, 'cloture', { motif: 'pas_interesse' })] })).cloture).toMatchObject({ motif: 'pas_interesse' });
  });
  it('ignore les relances et notes', () => {
    expect(decisionsCourantes(avec({ actions: [relance(1), act({ date: ilYa(1), type: 'note', statut: 'note' })] }))).toEqual({ cloture: null, echeance: null, responsable: null, derniereReponse: null });
  });
});

describe('dernierContact / reponseRecue', () => {
  it('dernier contact : envoyé ou préparé seulement', () => {
    expect(dernierContact(avec({ actions: [relance(9), relance(3, 'prepare'), relance(1, 'echec'), relance(0, 'envoi')] }))).toBe(ilYa(3));
    expect(dernierContact(d0)).toBeNull();
  });
  it('réponse : décision ou message postérieur au contact, jamais avant', () => {
    expect(reponseRecue(avec({ actions: [relance(5)], messages: [{ date: ilYa(2) }] }))).toBe(true);
    expect(reponseRecue(avec({ actions: [relance(5), decision(1, 'reponse')] }))).toBe(true);
    expect(reponseRecue(avec({ actions: [relance(5)], messages: [{ date: ilYa(9) }] }))).toBe(false);
    expect(reponseRecue(avec({ messages: [{ date: ilYa(2) }] }))).toBe(false);
  });
});

describe('vueDe : exclusivité et priorité', () => {
  const fixtures: Record<string, Dossier> = {
    premium: avec({ premium: true, actions: [decision(1, 'cloture', { motif: 'doublon' })] }),
    oppose: avec({ oppose: true, paiements: [pay('m', 'pending', 'manual', 3)] }),
    cloture: avec({ actions: [decision(5, 'cloture', { motif: 'pas_interesse' }), relance(20)] }),
    verif: avec({ paiements: [pay('m', 'pending', 'manual', 3)], actions: [relance(30)] }),
    echeance: avec({ actions: [decision(8, 'echeance', { echeance: jourDans(0) })] }),
    reponse: avec({ actions: [relance(5)], messages: [{ date: ilYa(1) }] }),
    silence: avec({ actions: [relance(12)] }),
    attenteContact: avec({ actions: [relance(2)] }),
    attenteEcheance: avec({ actions: [decision(1, 'echeance', { echeance: jourDans(3) })] }),
    jamais: d0,
  };
  it('chaque fixture tombe dans exactement une vue connue', () => {
    for (const [nom, d] of Object.entries(fixtures)) {
      const v = vueDe(d, MAINT);
      expect(VUES, nom).toContain(v.vue);
      expect(v.raison, nom).not.toBe('');
    }
  });
  it('priorité : convertis > clôturés > paiements à vérifier > à traiter', () => {
    expect(vueDe(fixtures.premium!, MAINT).vue).toBe('convertis');
    expect(vueDe(fixtures.oppose!, MAINT).vue).toBe('clotures');
    expect(vueDe(fixtures.cloture!, MAINT).vue).toBe('clotures');
    expect(vueDe(fixtures.verif!, MAINT).vue).toBe('paiements_a_verifier');
  });
  it('opposition => clôturés, raison contenant « opposition »', () => {
    expect(vueDe(fixtures.oppose!, MAINT).raison.toLowerCase()).toContain('opposition');
  });
  it('à traiter : échéance atteinte, réponse après contact, silence au-delà du délai', () => {
    expect(vueDe(fixtures.echeance!, MAINT)).toMatchObject({ vue: 'a_traiter', echeance: jourDans(0) });
    expect(vueDe(fixtures.reponse!, MAINT).vue).toBe('a_traiter');
    expect(vueDe(fixtures.silence!, MAINT).vue).toBe('a_traiter');
    expect(vueDe(fixtures.silence!, MAINT).raison).toContain('sans réponse depuis 12 jours');
  });
  it('délai de suivi : 6 jours en attente, 7 jours à traiter (réglage par défaut)', () => {
    expect(vueDe(avec({ actions: [relance(6)] }), MAINT).vue).toBe('en_attente');
    expect(vueDe(avec({ actions: [relance(7)] }), MAINT).vue).toBe('a_traiter');
    expect(vueDe(avec({ actions: [relance(7)] }), MAINT, { delai_suivi_jours: 14 }).vue).toBe('en_attente');
  });
  it('en attente : contact récent, ou échéance future', () => {
    expect(vueDe(fixtures.attenteContact!, MAINT).vue).toBe('en_attente');
    expect(vueDe(fixtures.attenteEcheance!, MAINT)).toMatchObject({ vue: 'en_attente', echeance: jourDans(3) });
  });
  it('une relance faite à la date d\'échéance consomme l\'échéance', () => {
    const d = avec({ actions: [decision(8, 'echeance', { echeance: jourDans(-2) }), relance(1)] });
    expect(vueDe(d, MAINT).vue).toBe('en_attente');
  });
  it('jamais contactés', () => {
    expect(vueDe(d0, MAINT).vue).toBe('jamais_contactes');
  });
  it('réouverture annule la clôture', () => {
    const d = avec({ actions: [decision(10, 'cloture', { motif: 'doublon' }), decision(2, 'reouverture')] });
    expect(vueDe(d, MAINT).vue).toBe('jamais_contactes');
  });
  it('une réponse déclarée après le contact fait passer à traiter', () => {
    expect(vueDe(avec({ actions: [relance(5), decision(1, 'reponse')] }), MAINT).vue).toBe('a_traiter');
  });
});

describe('actionRecommandee', () => {
  const reco = (d: Dossier) => {
    const etat = etatPaiement(d, MAINT);
    const { vue } = vueDe(d, MAINT);
    return actionRecommandee(d, vue, etat, MAINT);
  };
  it('paiement à vérifier', () => {
    const r = reco(avec({ paiements: [pay('m', 'pending', 'manual', 8, 25000)] }));
    expect(r.libelle).toBe('Vérifier le paiement');
    expect(r.justification).toContain('25 000 FCFA');
    expect(r.justification).toContain('dans Paiements');
  });
  it('silence', () => {
    expect(reco(avec({ actions: [relance(12)] }))).toEqual({ libelle: 'Relancer', justification: `Contacté le ${ilYa(12).slice(8, 10)}/${ilYa(12).slice(5, 7)}, sans réponse depuis 12 jours.` });
  });
  it('réponse reçue', () => {
    const r = reco(avec({ actions: [relance(5)], messages: [{ date: ilYa(1) }] }));
    expect(r.libelle).toBe('Répondre');
    expect(r.justification).toContain('Réponse reçue le');
  });
  it('jamais contacté : première raison du score', () => {
    const r = reco(avec({ newsletter: true }));
    expect(r.libelle).toBe('Premier contact');
    expect(r.justification).toContain('abonné à la newsletter');
  });
  it('jamais contacté sans signal : pas de chiffre inventé', () => {
    expect(reco(d0).justification).toBe('Jamais contacté ; aucun signal particulier.');
  });
  it('en attente avec échéance', () => {
    const r = reco(avec({ actions: [decision(1, 'echeance', { echeance: jourDans(3) })] }));
    expect(r.libelle).toBe('Attendre');
    expect(r.justification).toContain('Suivi prévu le');
  });
  it('convertis et clôturés : aucune action', () => {
    expect(reco(avec({ premium: true })).libelle).toBe('Aucune action');
    const c = reco(avec({ actions: [decision(2, 'cloture', { motif: 'deja_abonne' })] }));
    expect(c.libelle).toBe('Aucune action');
    expect(c.justification).toContain('déjà abonné');
  });
});

describe('constantes', () => {
  it('six vues libellées, délai de suivi par défaut 7', () => {
    expect(VUES).toHaveLength(6);
    for (const v of VUES) expect(LIB_VUE[v]).toBeTruthy();
    expect(REGLAGES_DEFAUT).toEqual({ delai_suivi_jours: 7 });
  });
});
