import { describe, it, expect } from 'vitest';
import { compareIso, scorer, estExclu, fmtFcfa } from './score';
import type { Dossier } from './types';

const MAINTENANT = new Date('2026-10-31T12:00:00Z');
const ilYa = (j: number) => new Date(MAINTENANT.getTime() - j * 86_400_000).toISOString();
const d0: Dossier = {
  cle: 'u1', emailNorm: 'a@b.c', userId: 'u1', nom: null, inscritLe: null, derniereConnexion: null,
  premium: false, admin: false, oppose: false, paiementsEnAttente: [], paiementsReussis: [], paiements: [], offreVues: [], formationVues: [], pays: null, formationAchetee: null,
  lignesPortefeuille: 0, messages: [], prospect: null, newsletter: false, leconsAcademy: 0, actions: [],
  whatsapp: { numero: null, source: null, lieSansNumero: false, recontact: false }, bonus: [],
};

describe('scorer', () => {
  it('paiement inachevé : 40 points, raison datée avec le montant', () => {
    const s = scorer({ ...d0, paiementsEnAttente: [{ montant: 5000, devise: 'XOF', date: ilYa(19) }] }, MAINTENANT);
    expect(s.score).toBe(40);
    expect(s.raisons[0]!.texte).toBe(`paiement de ${fmtFcfa(5000)} commencé le 12/10, non terminé`);
  });

  it('paiement inachevé en EUR : la devise est affichée, jamais FCFA', () => {
    const s = scorer({ ...d0, paiementsEnAttente: [{ montant: 50, devise: 'EUR', date: ilYa(19) }] }, MAINTENANT);
    expect(s.raisons[0]!.texte).toBe('paiement de 50 EUR commencé le 12/10, non terminé');
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

  it('formation consultée : 30 jours compte, 31 non ; texte factuel', () => {
    const jour = (j: number) => ilYa(j).slice(0, 10);
    const s = scorer({ ...d0, formationVues: [{ page: '/formations/academy', jour: jour(30) }, { page: '/formations/academy/lecon-0', jour: jour(5) }] }, MAINTENANT);
    expect(s.score).toBe(15);
    expect(s.raisons[0]).toMatchObject({ code: 'formation', texte: `a consulté la formation 2 fois, dernière le ${jour(5).slice(8, 10)}/${jour(5).slice(5, 7)}` });
    expect(scorer({ ...d0, formationVues: [{ page: '/formations/academy', jour: jour(31) }] }, MAINTENANT).score).toBe(0);
    expect(scorer({ ...d0, formationVues: [{ page: '/formations/academy', jour: jour(2) }] }, MAINTENANT).raisons[0].texte).toContain('une fois');
  });

  it('connexion : 15 points jusqu’à 7 jours, 5 de 8 à 30, 0 au-delà', () => {
    expect(scorer({ ...d0, derniereConnexion: ilYa(7) }, MAINTENANT).score).toBe(15);
    expect(scorer({ ...d0, derniereConnexion: ilYa(8) }, MAINTENANT).score).toBe(5);
    expect(scorer({ ...d0, derniereConnexion: ilYa(30) }, MAINTENANT).score).toBe(5);
    expect(scorer({ ...d0, derniereConnexion: ilYa(31) }, MAINTENANT).score).toBe(0);
  });

  it('connexion : 7,5 jours = 7 jours pour le texte ET le poids', () => {
    const s = scorer({ ...d0, derniereConnexion: ilYa(7.5) }, MAINTENANT);
    expect(s.score).toBe(15);
    expect(s.raisons[0].texte).toBe('connecté il y a 7 jours');
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

describe('scorer : offre utilisée', () => {
  it("compte l'offre utilisée dans les 30 jours", () => {
    const s = scorer({ ...d0, bonus: [{ code: 'SNTS', date: '2026-10-30T10:00:00Z' }] }, MAINTENANT);
    expect(s.raisons.find((r) => r.code === 'bonus')).toMatchObject({ points: 25, texte: 'a téléchargé le dossier SNTS le 30/10' });
  });
  it('ignore une offre utilisée il y a plus de 30 jours', () => {
    const s = scorer({ ...d0, bonus: [{ code: 'SNTS', date: ilYa(31) }] }, MAINTENANT);
    expect(s.raisons.find((r) => r.code === 'bonus')).toBeUndefined();
  });
});

describe('compareIso', () => {
  it('classe juste une seconde entière face à une fraction de seconde', () => {
    expect(compareIso('2026-10-31T12:00:00Z', '2026-10-31T12:00:00.500Z')).toBe(-1);
    expect(compareIso('2026-10-31T12:00:00.500+00:00', '2026-10-31T12:00:01Z')).toBe(-1);
    expect(compareIso('2026-10-31T12:00:00Z', '2026-10-31T12:00:00Z')).toBe(0);
    expect(['2026-10-31T12:00:01Z', '2026-10-31T12:00:00.9Z'].sort(compareIso)).toEqual(['2026-10-31T12:00:00.9Z', '2026-10-31T12:00:01Z']);
  });
});
