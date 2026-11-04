import { describe, it, expect, afterEach } from 'vitest';
import { validerReponseJev } from './validerJev';
import { classerParJev, construireRequeteJev, CLE_GLOBALE } from './jev';
import { Sequenceur } from './sequenceur';
import type { FicheSociete } from './types';

const fiches: FicheSociete[] = [
  { code: 'SNTS', nom: 'Sonatel', faits: [], texte: 'SNTS — Sonatel.' },
  { code: 'SGBC', nom: 'SGCI', faits: [], texte: 'SGBC — SGCI.' },
];
const noul = (p: unknown) => ({ type: 'noul', noul: p });
const ok = { model: 'jev-1', answers: { SNTS: noul(0.9), SGBC: noul(0.1), [CLE_GLOBALE]: noul(0.8) } };

describe('validation de la réponse de Jev', () => {
  it('accepte une réponse complète et cohérente', () => {
    expect(validerReponseJev(ok, ['SNTS', 'SGBC'])).toEqual({ scores: { SNTS: 0.9, SGBC: 0.1 }, pertinenceGlobale: 0.8, modele: 'jev-1' });
  });

  it.each([
    ['code inconnu', { answers: { ...ok.answers, XXXX: noul(0.5) } }],
    ['doublon de casse', { answers: { ...ok.answers, snts: noul(0.5) } }],
    ['score hors [0,1]', { answers: { ...ok.answers, SNTS: noul(1.2) } }],
    ['score NaN', { answers: { ...ok.answers, SNTS: noul(Number.NaN) } }],
    ['score non numérique', { answers: { ...ok.answers, SNTS: noul('0.9') } }],
    ['code manquant', { answers: { SNTS: noul(0.9), [CLE_GLOBALE]: noul(0.8) } }],
    ['pertinence globale absente', { answers: { SNTS: noul(0.9), SGBC: noul(0.1) } }],
    ['mauvais type de question', { answers: { ...ok.answers, SNTS: { type: 'score', score: 0.9 } } }],
    ['corps sans answers', { model: 'x' }],
    ['corps nul', null],
  ])('rejette : %s', (_nom, brut) => {
    expect(validerReponseJev(brut, ['SNTS', 'SGBC'])).toBeNull();
  });
});

describe('requête TypeSafe', () => {
  afterEach(() => {
    delete process.env.TYPESAFE_API_KEY;
  });

  it('pose une question oui/non par société et une question globale', () => {
    const r = construireRequeteJev('une banque', fiches, 'jev-latest');
    expect(r.state).toEqual({ query: 'une banque', candidates: { SNTS: 'SNTS — Sonatel.', SGBC: 'SGBC — SGCI.' } });
    expect(Object.keys(r.questions).sort()).toEqual([CLE_GLOBALE, 'SGBC', 'SNTS'].sort());
    expect(r.questions.SNTS!.type).toBe('noul');
    expect(r.questions.SNTS!.instructions).toContain('`candidates.SNTS`');
  });

  it('envoie la clé en Bearer, jamais dans le corps', async () => {
    process.env.TYPESAFE_API_KEY = 'apikey_test';
    const vus: { url: string; init: RequestInit }[] = [];
    const fauxFetch = async (url: string, init?: RequestInit) => {
      vus.push({ url, init: init! });
      return new Response(JSON.stringify(ok), { status: 200 });
    };
    await classerParJev('une banque', fiches, new AbortController().signal, fauxFetch);
    const vu = vus[0]!;
    expect(vu.url).toBe('https://api.typesafe.ai/v1/systemone');
    expect((vu.init.headers as Record<string, string>).Authorization).toBe('Bearer apikey_test');
    expect(String(vu.init.body)).not.toContain('apikey_test');
  });

  it('échoue proprement sans clé ou sur erreur HTTP, sans citer la requête', async () => {
    await expect(classerParJev('secret q', fiches, new AbortController().signal)).rejects.toThrow('jev_cle_absente');
    process.env.TYPESAFE_API_KEY = 'k';
    const erreur500 = async () => new Response('boom', { status: 500 });
    await expect(classerParJev('secret q', fiches, new AbortController().signal, erreur500)).rejects.toThrow(/^jev_http_500$/);
  });
});

describe('séquenceur de l’interface', () => {
  it('seule la dernière recherche lancée est courante', () => {
    const s = new Sequenceur();
    const a = s.suivante();
    const b = s.suivante();
    expect(s.estCourante(a)).toBe(false);
    expect(s.estCourante(b)).toBe(true);
  });
});
