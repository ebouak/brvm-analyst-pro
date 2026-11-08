import { describe, it, expect } from 'vitest';
import {
  INTENTIONS_FICHE,
  QUESTION_FICHE,
  construireRequeteIntention,
  validerIntention,
  deciderIntention,
  lirePeriode,
  lireExercice,
  type IntentionFiche,
} from './intention';

const LISTE = Object.keys(INTENTIONS_FICHE) as IntentionFiche[];
const brut = (choice: string, p = 0.95) => ({
  answers: {
    [QUESTION_FICHE]: {
      type: 'choice',
      choice,
      probabilities: Object.fromEntries(LISTE.map((k) => [k, k === choice ? p : (1 - p) / (LISTE.length - 1)])),
    },
  },
});

describe('requête Jev', () => {
  it('une seule question à choix, la valeur dans l’état, les critères = intentions', () => {
    const r = construireRequeteIntention('Les dernières actualités', { code: 'STAC', nom: 'SETAO CI' });
    expect(Object.keys(r.questions)).toEqual([QUESTION_FICHE]);
    expect(r.state).toEqual({ question: 'Les dernières actualités', valeur: 'STAC — SETAO CI' });
    expect((r.questions[QUESTION_FICHE] as { criteria: object }).criteria).toEqual(INTENTIONS_FICHE);
  });
});

describe('validation', () => {
  it('accepte une réponse complète', () => {
    expect(validerIntention(brut('dividendes'))).toMatchObject({ intention: 'dividendes' });
  });
  it.each([
    ['corps nul', null],
    ['sans answers', {}],
    ['intention inconnue', brut('acheter')],
    ['probabilité hors bornes', { answers: { [QUESTION_FICHE]: { type: 'choice', choice: 'cours_jour', probabilities: { cours_jour: 2 } } } }],
    ['mauvais type', { answers: { [QUESTION_FICHE]: { type: 'noul', noul: 1 } } }],
  ])('rejette : %s', (_n, b) => {
    expect(validerIntention(b)).toBeNull();
  });
});

describe('décision', () => {
  it('sûr et déterministe ⇒ jev', () => {
    expect(deciderIntention(validerIntention(brut('cours_jour'))!)).toEqual({ voie: 'jev', intention: 'cours_jour' });
    expect(deciderIntention(validerIntention(brut('conseil'))!)).toEqual({ voie: 'jev', intention: 'conseil' });
  });
  it('« autre » ⇒ ia même si sûr', () => {
    expect(deciderIntention(validerIntention(brut('autre'))!)).toEqual({ voie: 'ia' });
  });
  it('incertain ⇒ ia', () => {
    expect(deciderIntention(validerIntention(brut('dividendes', 0.6))!)).toEqual({ voie: 'ia' });
  });
  it('marge trop faible ⇒ ia', () => {
    const b = { answers: { [QUESTION_FICHE]: { type: 'choice', choice: 'comptes', probabilities: { comptes: 0.86, technique: 0.4 } } } };
    expect(deciderIntention(validerIntention(b)!)).toEqual({ voie: 'ia' });
  });
});

describe('période et exercice lus dans la question', () => {
  it.each([
    ['depuis un an', 365],
    ['sur 3 mois', 90],
    ['sur six mois', 180],
    ['cette semaine', 7],
    ['sur 2 ans', 730],
    ['depuis 30 jours', 30],
    ['ce mois-ci', 30],
  ])('%s', (q, j) => {
    expect(lirePeriode(`Comment a évolué le cours ${q} ?`)).toEqual({ jours: j });
  });
  it('toute la période', () => {
    expect(lirePeriode('depuis son introduction en bourse')).toEqual({ jours: null });
    expect(lirePeriode('sur tout l’historique')).toEqual({ jours: null });
  });
  it('rien de lisible ⇒ null', () => {
    expect(lirePeriode('Comment a évolué le cours ?')).toBeNull();
  });
  it('exercice', () => {
    expect(lireExercice('Résume les comptes 2025 de SETAO CI')).toBe(2025);
    expect(lireExercice('Résume les derniers comptes')).toBeNull();
    expect(lireExercice('les comptes 1850')).toBeNull();
  });
});
