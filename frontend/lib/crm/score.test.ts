import { describe, it, expect } from 'vitest';
import { scorer, estExclu, fmtFcfa } from './score';
import type { Dossier } from './types';

const MAINTENANT = new Date('2026-10-31T12:00:00Z');
const ilYa = (j: number) => new Date(MAINTENANT.getTime() - j * 86_400_000).toISOString();
const d0: Dossier = {
  cle: 'u1', emailNorm: 'a@b.c', userId: 'u1', nom: null, inscritLe: null, derniereConnexion: null,
  premium: false, admin: false, oppose: false, paiementsEnAttente: [], paiementsReussis: [], offreVues: [],
  lignesPortefeuille: 0, messages: [], prospect: null, newsletter: false, leconsAcademy: 0, actions: [],
};

describe('scorer', () => {
  it('paiement inachevé : 40 points, raison datée avec le montant', () => {
    const s = scorer({ ...d0, paiementsEnAttente: [{ montant: 5000, devise: 'XOF', date: ilYa(19) }] }, MAINTENANT);
    expect(s.score).toBe(40);
    expect(s.raisons[0]!.texte).toBe(`paiement de ${fmtFcfa(5000)} commencé le 12/10, non terminé`);
  });

  it('paiement inachevé : 30 jours compte, 31 non', () => {
    expect(scorer({ ...d0, paiementsEnAttente: [{ montant: 1, devise: 'XOF', date: ilYa(30) }] }, MAINTENANT).score).toBe(40);
    expect(scorer({ ...d0, paiementsEnAttente: [{ montant: 1, devise: 'XOF', date: ilYa(31) }] }, MAINTENANT).score).toBe(0);
  });

  it('offre consultée : 14 jours compte, 15 non', () => {
    const jour = (j: number) => ilYa(j).slice(0, 10);
    expect(scorer({ ...d0, offreVues: [{ page: '/pricing', jour: jour(14) }] }, MAINTENANT).score).toBe(20);
    expect(scorer({ ...d0, offreVues: [{ page: '/pricing', jour: jour(15) }] }, MAINTENANT).score).toBe(0);
  });

  it('connexion : 15 points jusqu’à 7 jours, 5 de 8 à 30, 0 au-delà', () => {
    expect(scorer({ ...d0, derniereConnexion: ilYa(7) }, MAINTENANT).score).toBe(15);
    expect(scorer({ ...d0, derniereConnexion: ilYa(8) }, MAINTENANT).score).toBe(5);
    expect(scorer({ ...d0, derniereConnexion: ilYa(30) }, MAINTENANT).score).toBe(5);
    expect(scorer({ ...d0, derniereConnexion: ilYa(31) }, MAINTENANT).score).toBe(0);
  });

  it('cumule portefeuille, contact, newsletter, Academy', () => {
    const s = scorer({ ...d0, lignesPortefeuille: 4, messages: [{ date: ilYa(6) }], newsletter: true, leconsAcademy: 3 }, MAINTENANT);
    expect(s.score).toBe(30);
    expect(s.raisons.map((r) => r.code)).toEqual(['portefeuille', 'contact', 'newsletter', 'academy']);
  });

  it('plafonne à 100 et classe chaud / tiède / froid', () => {
    const plein: Dossier = {
      ...d0, paiementsEnAttente: [{ montant: 1, devise: 'XOF', date: ilYa(1) }], offreVues: [{ page: '/pricing', jour: ilYa(1).slice(0, 10) }],
      derniereConnexion: ilYa(1), lignesPortefeuille: 1, messages: [{ date: ilYa(1) }], newsletter: true, leconsAcademy: 1,
    };
    expect(scorer(plein, MAINTENANT)).toMatchObject({ score: 100, niveau: 'chaud' });
    expect(scorer({ ...d0, derniereConnexion: ilYa(1), lignesPortefeuille: 1 }, MAINTENANT).niveau).toBe('tiede');
    expect(scorer(d0, MAINTENANT)).toMatchObject({ score: 0, niveau: 'froid', raisons: [] });
  });

  it('les raisons ne citent que des faits du dossier', () => {
    const s = scorer({ ...d0, lignesPortefeuille: 4, leconsAcademy: 3 }, MAINTENANT);
    expect(s.raisons.map((r) => r.texte)).toEqual(['portefeuille de 4 lignes', "3 leçons de l'Academy suivies"]);
  });
});

describe('estExclu', () => {
  it('exclut Premium, administrateurs et personnes opposées', () => {
    expect(estExclu({ ...d0, premium: true })).toBe(true);
    expect(estExclu({ ...d0, admin: true })).toBe(true);
    expect(estExclu({ ...d0, oppose: true })).toBe(true);
    expect(estExclu(d0)).toBe(false);
  });
});
