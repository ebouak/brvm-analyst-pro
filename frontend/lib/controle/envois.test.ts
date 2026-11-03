import { describe, it, expect } from 'vitest';
import { evaluerEnvois, type DonneesEnvois } from './envois';
import type { Signal } from './types';

const MAINT = new Date('2026-11-03T12:00:00Z');
/** ISO à `h` heures avant MAINT. */
const ilYa = (h: number) => new Date(MAINT.getTime() - h * 3_600_000).toISOString();
const J = 24;

function vide(): DonneesEnvois {
  return {
    notifications: [],
    declenchements: [],
    abonnesAlertes: {
      email: { demandeurs: 0, joignables: [] },
      telegram: { demandeurs: 0, joignables: [] },
      whatsapp: { demandeurs: 0, joignables: [] },
    },
    dossiers: [],
    abonnesDossiers: {
      email: { demandeurs: 0, joignables: [] },
      telegram: { demandeurs: 0, joignables: [] },
      whatsapp: { demandeurs: 0, joignables: [] },
    },
    contact: [],
    social: [],
    campagnes: [],
    relances: [],
    derniersSucces: {},
  };
}

const par = (s: Signal[], id: string): Signal => {
  const t = s.find((x) => x.id === id);
  if (!t) throw new Error(`signal absent : ${id} (présents : ${s.map((x) => x.id).join(', ')})`);
  return t;
};

const notif = (channel: string, status: string, h: number, user = 'u1', alerte = true) => ({
  user_id: user,
  channel,
  status,
  created_at: ilYa(h),
  alerte,
});

describe('evaluerEnvois — forme', () => {
  it('rend un signal par flux, tous du domaine envois, aux identifiants uniques', () => {
    const s = evaluerEnvois(vide(), MAINT);
    const ids = s.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(s.every((x) => x.domaine === 'envois')).toBe(true);
    for (const id of [
      'envois:alertes:email',
      'envois:alertes:telegram',
      'envois:alertes:whatsapp',
      'envois:dossiers:email',
      'envois:dossiers:telegram',
      'envois:dossiers:whatsapp',
      'envois:contact',
      'envois:reseaux',
      'envois:campagnes',
      'envois:relances-crm',
    ]) {
      par(s, id);
    }
  });

  it('base vide : rien en alerte, canaux non demandés « non applicables », chaque phrase porte un chiffre', () => {
    const s = evaluerEnvois(vide(), MAINT);
    expect(s.every((x) => x.niveau === 'ok' || x.niveau === 'na')).toBe(true);
    for (const x of s) expect(x.detail).toMatch(/\d/);
  });
});

describe('alertes — canaux personnels', () => {
  it('personne n’a demandé le canal : non applicable (ne gonfle pas les OK)', () => {
    const t = par(evaluerEnvois(vide(), MAINT), 'envois:alertes:email');
    expect(t.niveau).toBe('na');
    expect(t.detail).toMatch(/Non applicable/);
  });

  it('demandé sans conversation reliée : à surveiller (activation incomplète), et le dit', () => {
    const d = vide();
    d.abonnesAlertes.whatsapp = { demandeurs: 1, joignables: [] };
    const t = par(evaluerEnvois(d, MAINT), 'envois:alertes:whatsapp');
    expect(t.niveau).toBe('attention');
    expect(t.detail).toMatch(/1 compte a demandé WhatsApp/);
    expect(t.detail).toMatch(/pas reliée/);
  });

  it('envois réussis : ok, volume et échecs chiffrés, dernier succès renseigné', () => {
    const d = vide();
    d.abonnesAlertes.telegram = { demandeurs: 1, joignables: ['u1'] };
    d.notifications = [notif('telegram', 'sent', 30), notif('telegram', 'sent', 50), notif('telegram', 'sent', 9 * J)];
    d.derniersSucces['envois:alertes:telegram'] = ilYa(30);
    const t = par(evaluerEnvois(d, MAINT), 'envois:alertes:telegram');
    expect(t.niveau).toBe('ok');
    expect(t.detail).toMatch(/2 envois sur 7 j/);
    expect(t.detail).toMatch(/0 échec/);
    expect(t.dernierSucces).toBe(ilYa(30));
  });

  it('abonnés joignables mais AUCUN envoi jamais réussi : attention (canal peut-être pas branché)', () => {
    // Cas réel du 2026-11-03 : 4 comptes avaient demandé l'e-mail, aucun n'était
    // jamais parti (runAlerts appelait dispatch avec to: null).
    const d = vide();
    d.abonnesAlertes.email = { demandeurs: 4, joignables: ['u1', 'u2', 'u3', 'u4'] };
    const t = par(evaluerEnvois(d, MAINT), 'envois:alertes:email');
    expect(t.niveau).toBe('attention');
    expect(t.detail).toMatch(/4 comptes/);
    expect(t.detail).toMatch(/jamais/);
  });

  it('même règle pour les dossiers', () => {
    const d = vide();
    d.abonnesDossiers.email = { demandeurs: 2, joignables: ['u1', 'u2'] };
    expect(par(evaluerEnvois(d, MAINT), 'envois:dossiers:email').niveau).toBe('attention');
  });

  it('e-mail : une alerte de COURS déclenchée sans e-mail ensuite est une panne muette', () => {
    const d = vide();
    d.abonnesAlertes.email = { demandeurs: 1, joignables: ['u1'] };
    d.declenchements = [{ user_id: 'u1', at: ilYa(5), source: 'alerte' }];
    d.derniersSucces['envois:alertes:email'] = ilYa(10 * J);
    expect(par(evaluerEnvois(d, MAINT), 'envois:alertes:email').niveau).toBe('alerte');
  });

  it('les lignes hors alerte (point de clôture) ne comptent pas', () => {
    const d = vide();
    d.notifications = [notif('telegram', 'sent', 5, 'u1', false)];
    const t = par(evaluerEnvois(d, MAINT), 'envois:alertes:telegram');
    expect(t.detail).toMatch(/0 envoi sur 7 j/);
  });

  it('PANNE MUETTE : thèse déclenchée pour un abonné e-mail, aucun e-mail parti → alerte', () => {
    const d = vide();
    d.abonnesAlertes.email = { demandeurs: 4, joignables: ['u1', 'u2', 'u3', 'u4'] };
    d.declenchements = [{ user_id: 'u2', at: ilYa(48), source: 'these' }];
    // Telegram, lui, envoie : c'est la signature exacte de la panne de 7 semaines.
    d.notifications = [notif('telegram', 'sent', 40, 'u9')];
    const t = par(evaluerEnvois(d, MAINT), 'envois:alertes:email');
    expect(t.niveau).toBe('alerte');
    expect(t.detail).toMatch(/1 compte/);
  });

  it('abonnés e-mail, canal ayant déjà servi, aucune alerte déclenchée : ok (rien à envoyer n’est pas une panne)', () => {
    const d = vide();
    d.abonnesAlertes.email = { demandeurs: 4, joignables: ['u1', 'u2', 'u3', 'u4'] };
    d.notifications = [notif('telegram', 'sent', 40, 'u9')];
    d.derniersSucces['envois:alertes:email'] = ilYa(20 * J);
    const t = par(evaluerEnvois(d, MAINT), 'envois:alertes:email');
    expect(t.niveau).toBe('ok');
    expect(t.detail).toMatch(/4 comptes abonnés/);
  });

  it('déclenchement servi par un envoi réussi : ok', () => {
    const d = vide();
    d.abonnesAlertes.telegram = { demandeurs: 1, joignables: ['u1'] };
    d.declenchements = [{ user_id: 'u1', at: ilYa(20), source: 'alerte' }];
    d.notifications = [notif('telegram', 'sent', 20)];
    expect(par(evaluerEnvois(d, MAINT), 'envois:alertes:telegram').niveau).toBe('ok');
  });

  it('un envoi plus ANCIEN que le déclenchement ne le sert pas', () => {
    const d = vide();
    d.abonnesAlertes.telegram = { demandeurs: 1, joignables: ['u1'] };
    d.declenchements = [{ user_id: 'u1', at: ilYa(20), source: 'alerte' }];
    d.notifications = [notif('telegram', 'sent', 60)];
    expect(par(evaluerEnvois(d, MAINT), 'envois:alertes:telegram').niveau).toBe('alerte');
  });

  it('déclenchement de moins de 15 min : laissé au worker le temps de journaliser', () => {
    const d = vide();
    d.abonnesAlertes.telegram = { demandeurs: 1, joignables: ['u1'] };
    d.declenchements = [{ user_id: 'u1', at: ilYa(0.1), source: 'alerte' }];
    d.derniersSucces['envois:alertes:telegram'] = ilYa(3 * J);
    expect(par(evaluerEnvois(d, MAINT), 'envois:alertes:telegram').niveau).toBe('ok');
  });

  it('une alerte de COURS est due par e-mail aussi (avant le 2026-11-03, elle ne partait jamais)', () => {
    const d = vide();
    d.abonnesAlertes.email = { demandeurs: 1, joignables: ['u1'] };
    d.declenchements = [{ user_id: 'u1', at: ilYa(20), source: 'alerte' }];
    expect(par(evaluerEnvois(d, MAINT), 'envois:alertes:email').niveau).toBe('alerte');
  });

  it('un compte non joignable sur ce canal n’est pas dû', () => {
    const d = vide();
    d.abonnesAlertes.telegram = { demandeurs: 2, joignables: ['u1'] };
    d.declenchements = [{ user_id: 'u2', at: ilYa(20), source: 'alerte' }];
    d.derniersSucces['envois:alertes:telegram'] = ilYa(3 * J);
    expect(par(evaluerEnvois(d, MAINT), 'envois:alertes:telegram').niveau).toBe('ok');
  });

  it('échecs ≥ 50 % sur au moins 3 tentatives : alerte', () => {
    const d = vide();
    d.abonnesAlertes.telegram = { demandeurs: 1, joignables: ['u1'] };
    d.notifications = [notif('telegram', 'failed', 30), notif('telegram', 'failed', 50), notif('telegram', 'sent', 60)];
    const t = par(evaluerEnvois(d, MAINT), 'envois:alertes:telegram');
    expect(t.niveau).toBe('alerte');
    expect(t.detail).toMatch(/2 échecs/);
  });

  it('2 tentatives dont 1 échec ancien : pas d’alerte (échantillon trop mince)', () => {
    const d = vide();
    d.abonnesAlertes.telegram = { demandeurs: 1, joignables: ['u1'] };
    d.notifications = [notif('telegram', 'failed', 60), notif('telegram', 'sent', 70)];
    expect(par(evaluerEnvois(d, MAINT), 'envois:alertes:telegram').niveau).toBe('ok');
  });

  it('un échec dans les 24 h : attention', () => {
    const d = vide();
    d.abonnesAlertes.telegram = { demandeurs: 1, joignables: ['u1'] };
    d.notifications = [
      notif('telegram', 'failed', 3),
      notif('telegram', 'sent', 30),
      notif('telegram', 'sent', 40),
      notif('telegram', 'sent', 50),
    ];
    expect(par(evaluerEnvois(d, MAINT), 'envois:alertes:telegram').niveau).toBe('attention');
  });
});

describe('dossiers du samedi', () => {
  const dossier = (canal: string, statut: string, h: number) => ({ canal, statut, created_at: ilYa(h) });

  it('envoyé il y a 3 jours à un abonné : ok', () => {
    const d = vide();
    d.abonnesDossiers.email = { demandeurs: 1, joignables: ['u1'] };
    d.dossiers = [dossier('email', 'envoye', 3 * J)];
    d.derniersSucces['envois:dossiers:email'] = ilYa(3 * J);
    const t = par(evaluerEnvois(d, MAINT), 'envois:dossiers:email');
    expect(t.niveau).toBe('ok');
    expect(t.detail).toMatch(/1 envoi sur 7 j/);
  });

  it('abonné mais aucun passage depuis plus de 8 jours : attention', () => {
    const d = vide();
    d.abonnesDossiers.email = { demandeurs: 1, joignables: ['u1'] };
    d.dossiers = [dossier('email', 'envoye', 10 * J)];
    d.derniersSucces['envois:dossiers:email'] = ilYa(10 * J);
    const t = par(evaluerEnvois(d, MAINT), 'envois:dossiers:email');
    expect(t.niveau).toBe('attention');
    expect(t.detail).toMatch(/10 j/);
  });

  it('seulement « vide » (portefeuille sans ligne) cette semaine : ok, rien à envoyer', () => {
    const d = vide();
    d.abonnesDossiers.telegram = { demandeurs: 1, joignables: ['u1'] };
    d.dossiers = [dossier('telegram', 'vide', 2 * J)];
    d.derniersSucces['envois:dossiers:telegram'] = ilYa(20 * J);
    expect(par(evaluerEnvois(d, MAINT), 'envois:dossiers:telegram').niveau).toBe('ok');
  });

  it('un échec dans la semaine suffit à l’attention (flux hebdomadaire)', () => {
    const d = vide();
    d.abonnesDossiers.email = { demandeurs: 2, joignables: ['u1', 'u2'] };
    d.dossiers = [dossier('email', 'echec', 5 * J), dossier('email', 'envoye', 5 * J)];
    expect(par(evaluerEnvois(d, MAINT), 'envois:dossiers:email').niveau).toBe('attention');
  });

  it('envoi resté « en cours » plus d’une heure : attention', () => {
    const d = vide();
    d.abonnesDossiers.email = { demandeurs: 1, joignables: ['u1'] };
    d.dossiers = [dossier('email', 'en_cours', 2)];
    const t = par(evaluerEnvois(d, MAINT), 'envois:dossiers:email');
    expect(t.niveau).toBe('attention');
    expect(t.detail).toMatch(/en cours/);
  });

  it('WhatsApp demandé sans conversation reliée : à surveiller (activation incomplète)', () => {
    const d = vide();
    d.abonnesDossiers.whatsapp = { demandeurs: 1, joignables: [] };
    const t = par(evaluerEnvois(d, MAINT), 'envois:dossiers:whatsapp');
    expect(t.niveau).toBe('attention');
    expect(t.detail).toMatch(/1 compte/);
  });

  it('3 échecs sur 4 dans la semaine : alerte', () => {
    const d = vide();
    d.abonnesDossiers.email = { demandeurs: 4, joignables: ['a', 'b', 'c', 'd'] };
    d.dossiers = [
      dossier('email', 'echec', 2 * J),
      dossier('email', 'echec', 2 * J),
      dossier('email', 'echec', 2 * J),
      dossier('email', 'envoye', 2 * J),
    ];
    expect(par(evaluerEnvois(d, MAINT), 'envois:dossiers:email').niveau).toBe('alerte');
  });
});

describe('réponses du formulaire de contact', () => {
  const rep = (livraison: string | null, h: number, statut = 'repondu') => ({
    canal: 'email',
    statut,
    repondu_at: ilYa(h),
    livraison,
    livraison_at: livraison ? ilYa(h - 0.01) : null,
    derniere_activite_at: ilYa(h),
  });

  it('toutes remises : ok, chiffré', () => {
    const d = vide();
    d.contact = [rep('remis', 20), rep('remis', 50)];
    d.derniersSucces['envois:contact'] = ilYa(20);
    const t = par(evaluerEnvois(d, MAINT), 'envois:contact');
    expect(t.niveau).toBe('ok');
    expect(t.detail).toMatch(/2 réponses sur 7 j/);
  });

  it('réponse rejetée il y a 10 jours : alerte (fenêtre 30 j)', () => {
    const d = vide();
    d.contact = [rep('rejete', 10 * J)];
    expect(par(evaluerEnvois(d, MAINT), 'envois:contact').niveau).toBe('alerte');
  });

  it('réponse classée spam : alerte', () => {
    const d = vide();
    d.contact = [rep('spam', 2 * J)];
    expect(par(evaluerEnvois(d, MAINT), 'envois:contact').niveau).toBe('alerte');
  });

  it('remise non confirmée après 24 h : attention', () => {
    const d = vide();
    d.contact = [rep('envoye', 30)];
    expect(par(evaluerEnvois(d, MAINT), 'envois:contact').niveau).toBe('attention');
  });

  it('livraison nulle (réponse antérieure au suivi) : jamais « non confirmée »', () => {
    const d = vide();
    d.contact = [rep(null, 5 * J)];
    expect(par(evaluerEnvois(d, MAINT), 'envois:contact').niveau).toBe('ok');
  });

  it('envoi resté bloqué plus d’une heure : attention', () => {
    const d = vide();
    d.contact = [{ canal: 'email', statut: 'envoi', repondu_at: null, livraison: null, livraison_at: null, derniere_activite_at: ilYa(3) }];
    expect(par(evaluerEnvois(d, MAINT), 'envois:contact').niveau).toBe('attention');
  });
});

describe('réseaux sociaux', () => {
  const pub = (reseau: string, statut: string, h: number) => ({
    reseau,
    statut,
    lance_le: ilYa(h),
    termine_le: statut === 'publie' || statut === 'echec' ? ilYa(h - 0.01) : null,
  });

  it('sans aucune publication : un seul signal ok', () => {
    const s = evaluerEnvois(vide(), MAINT).filter((x) => x.id.startsWith('envois:reseaux'));
    expect(s).toHaveLength(1);
    expect(s[0].niveau).toBe('ok');
  });

  it('un signal par réseau présent', () => {
    const d = vide();
    d.social = [pub('tiktok', 'publie', 50), pub('linkedin', 'publie', 50)];
    const s = evaluerEnvois(d, MAINT);
    par(s, 'envois:reseaux:tiktok');
    par(s, 'envois:reseaux:linkedin');
  });

  it('publication « en cours » depuis plus d’une heure : alerte', () => {
    const d = vide();
    d.social = [pub('linkedin', 'en_cours', 2)];
    expect(par(evaluerEnvois(d, MAINT), 'envois:reseaux:linkedin').niveau).toBe('alerte');
  });

  it('« en cours » depuis 30 min : pas d’alerte', () => {
    const d = vide();
    d.social = [pub('linkedin', 'en_cours', 0.5)];
    expect(par(evaluerEnvois(d, MAINT), 'envois:reseaux:linkedin').niveau).toBe('ok');
  });

  it('« à valider » n’est pas un échec', () => {
    const d = vide();
    d.social = [pub('tiktok', 'a_valider', 5), pub('tiktok', 'a_valider', 6), pub('tiktok', 'a_valider', 7)];
    const t = par(evaluerEnvois(d, MAINT), 'envois:reseaux:tiktok');
    expect(t.niveau).toBe('ok');
    expect(t.detail).toMatch(/3 en attente de validation/);
  });

  it('un échec dans les 24 h : attention', () => {
    const d = vide();
    d.social = [pub('tiktok', 'echec', 2), pub('tiktok', 'publie', 30), pub('tiktok', 'publie', 40)];
    expect(par(evaluerEnvois(d, MAINT), 'envois:reseaux:tiktok').niveau).toBe('attention');
  });
});

describe('campagnes e-mail d’articles', () => {
  const camp = (statut: string, h: number, dest = 10, env = 10) => ({
    statut,
    destinataires: dest,
    envoyes: env,
    lance_le: ilYa(h),
    termine_le: statut === 'en_cours' ? null : ilYa(h - 0.1),
  });

  it('campagne complète : ok, destinataires chiffrés', () => {
    const d = vide();
    d.campagnes = [camp('envoye', 50, 12, 12)];
    const t = par(evaluerEnvois(d, MAINT), 'envois:campagnes');
    expect(t.niveau).toBe('ok');
    expect(t.detail).toMatch(/12/);
  });

  it('campagne partielle dans la semaine : attention', () => {
    const d = vide();
    d.campagnes = [camp('partiel', 50, 12, 9)];
    expect(par(evaluerEnvois(d, MAINT), 'envois:campagnes').niveau).toBe('attention');
  });

  it('campagne restée en cours plus d’une heure : attention', () => {
    const d = vide();
    d.campagnes = [camp('en_cours', 3, 12, 0)];
    expect(par(evaluerEnvois(d, MAINT), 'envois:campagnes').niveau).toBe('attention');
  });
});

describe('relances CRM par e-mail', () => {
  const rel = (statut: string, livraison: string | null, h: number) => ({ statut, livraison, created_at: ilYa(h) });

  it('relances remises : ok', () => {
    const d = vide();
    d.relances = Array.from({ length: 20 }, () => rel('envoye', 'remis', 30));
    expect(par(evaluerEnvois(d, MAINT), 'envois:relances-crm').niveau).toBe('ok');
  });

  it('une plainte pour spam sur 30 j : alerte', () => {
    const d = vide();
    d.relances = [rel('envoye', 'spam', 20 * J), rel('envoye', 'remis', 30)];
    expect(par(evaluerEnvois(d, MAINT), 'envois:relances-crm').niveau).toBe('alerte');
  });

  it('rejets ≥ 10 % sur au moins 10 envois : attention', () => {
    const d = vide();
    d.relances = [
      ...Array.from({ length: 18 }, () => rel('envoye', 'remis', 30)),
      rel('envoye', 'rejete', 30),
      rel('envoye', 'rejete', 30),
    ];
    expect(par(evaluerEnvois(d, MAINT), 'envois:relances-crm').niveau).toBe('attention');
  });

  it('1 rejet sur 20 : ok', () => {
    const d = vide();
    d.relances = [...Array.from({ length: 19 }, () => rel('envoye', 'remis', 30)), rel('envoye', 'rejete', 30)];
    expect(par(evaluerEnvois(d, MAINT), 'envois:relances-crm').niveau).toBe('ok');
  });
});

describe('RGPD', () => {
  it('aucun texte ne contient d’identifiant de compte ni d’adresse', () => {
    const d = vide();
    d.abonnesAlertes.email = { demandeurs: 1, joignables: ['5b1c0b4e-aaaa-bbbb-cccc-000000000001'] };
    d.declenchements = [{ user_id: '5b1c0b4e-aaaa-bbbb-cccc-000000000001', at: ilYa(20), source: 'these' }];
    const s = evaluerEnvois(d, MAINT);
    for (const x of s) {
      expect(x.detail).not.toMatch(/@/);
      expect(x.detail).not.toMatch(/5b1c0b4e/);
    }
  });
});
