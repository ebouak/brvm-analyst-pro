import { describe, it, expect } from 'vitest';
import { resumeAudience, alerteBaisse, analyseJour, messageJour, decisionJour, serieVide, classeErreur, blocsIndisponibles } from './resume';
import type { Audience } from './types';

const ok = <T,>(data: T) => ({ ok: true as const, data });
const ko = { ok: false as const, erreur: 'http_500' };
const base = (): Audience => ({
  debut: '2026-10-01T00:00:00.000Z', fin: '2026-11-01T00:00:00.000Z',
  overview: ok({ evenements: 900, pagesVues: 500, personnes: 100, sessions: 140 }),
  overviewPrecedent: ok({ evenements: 800, pagesVues: 400, personnes: 80, sessions: 100 }),
  continents: ok([{ code: 'AF', nom: 'Afrique', personnes: 25, sessions: 30 }, { code: 'EU', nom: 'Europe', personnes: 70, sessions: 90 }]),
  continentsPrecedent: ok([]),
  pays: ok([{ code: 'CI', nom: "Côte d'Ivoire", personnes: 10, sessions: 12, uemoa: true }, { code: 'MA', nom: 'Maroc', personnes: 5, sessions: 6, uemoa: false }]),
  villes: ok([]), sessions: ok({ sessions: 140, dureeMoyenneS: 90, dureeMedianeS: 40, pagesParSession: 3 }),
  pages: ok([{ chemin: '/', vues: 200, personnes: 90 }]), clics: ok([]), appareils: ok([]), tendance: ok([]),
  entonnoir: ok({ academy: 30, lecon: 12, inscription: 4 }),
  formationCrm: ok({ comptes: 6, afrique: 4, uemoa: 3, paysInconnu: 1 }),
});

describe('resumeAudience', () => {
  it('cite uniquement des chiffres mesurés, avec le Δ', () => {
    const r = resumeAudience(base(), { evenements: 0, pagesVues: 0, personnes: 80, sessions: 0 }).join(' ');
    expect(r).toContain('100 personne(s)');
    expect(r).toContain('+25 %');
    expect(r).toContain('25 personne(s), soit 25 %');
    expect(r).toContain('Zone UEMOA : 10 personne(s) sur 1 pays');
    expect(r).toContain('Page la plus vue : /');
    expect(r).toContain('4 en Afrique, dont 3 en UEMOA');
  });
  it('aucune causalité ni extrapolation', () => {
    const r = resumeAudience(base(), null).join(' ').toLowerCase();
    for (const mot of ['grâce', 'à cause', 'parce que', 'explique', 'tendance à', 'devrait']) expect(r).not.toContain(mot);
  });
  it('sans période précédente : pas de Δ inventé', () => {
    expect(resumeAudience(base(), null).join(' ')).not.toContain('par rapport à la période précédente');
  });
  it('blocs indisponibles déclarés comme tels', () => {
    const a = { ...base(), overview: ko, entonnoir: ko, formationCrm: ko };
    const r = resumeAudience(a, null).join(' ');
    expect(r).toContain('injoignable');
    expect(r).toContain('Entonnoir Academy indisponible');
    expect(r).toContain('CRM indisponible');
  });
});

describe('check quotidien', () => {
  it('alerteBaisse : seuil 50 % strict, jamais sans référence', () => {
    expect(alerteBaisse(49, 100)).toBe(true);
    expect(alerteBaisse(50, 100)).toBe(false);
    expect(alerteBaisse(0, 0)).toBe(false);
  });
  it('analyseJour : moyenne des 7 jours précédents, jour manquant = 0', () => {
    const serie = [
      { jour: '2026-10-27', personnes: 10, sessions: 12, pagesVues: 30, afrique: 2 },
      { jour: '2026-10-28', personnes: 20, sessions: 22, pagesVues: 40, afrique: 4 },
      { jour: '2026-11-03', personnes: 3, sessions: 3, pagesVues: 5, afrique: 0 },
    ];
    const a = analyseJour(serie, '2026-11-03');
    expect(a.jour.personnes).toBe(3);
    expect(a.moyenne.personnes).toBeCloseTo(30 / 7);
    expect(a.baisse).toBe(false);
    const b = analyseJour([{ jour: '2026-10-30', personnes: 70, sessions: 0, pagesVues: 0, afrique: 0 }, { jour: '2026-11-03', personnes: 4, sessions: 0, pagesVues: 0, afrique: 0 }], '2026-11-03');
    expect(b.baisse).toBe(true);
  });
  it('veille absente de la série = zéro, et le message le dit avec ⚠️ si baisse', () => {
    const a = analyseJour([{ jour: '2026-11-01', personnes: 70, sessions: 0, pagesVues: 0, afrique: 0 }], '2026-11-03');
    expect(a.jour.personnes).toBe(0);
    const m = messageJour(a);
    expect(m.texte.startsWith('⚠️ Baisse anormale')).toBe(true);
    expect(m.titre).toContain('⚠️');
  });
  it('message normal : sans ⚠️ et sans donnée personnelle', () => {
    const m = messageJour({ jour: { jour: '2026-11-03', personnes: 50, sessions: 60, pagesVues: 120, afrique: 9 }, moyenne: { personnes: 48, sessions: 55, pagesVues: 100, afrique: 8 }, baisse: false });
    expect(m.texte).not.toContain('⚠️');
    expect(m.texte).toContain('Afrique 9');
    expect(m.texte).toContain('2026-11-03');
  });
});

describe('décisions du cron', () => {
  const plein = [{ jour: '2026-11-03', personnes: 5, sessions: 5, pagesVues: 9, afrique: 1 }];
  const zeros = [{ jour: '2026-11-03', personnes: 0, sessions: 0, pagesVues: 0, afrique: 0 }];
  it('notification non livrée = 500', () => { expect(decisionJour(plein, false)).toEqual({ http: 500, erreur: 'notification' }); });
  it('série entièrement vide = 500, même notifiée', () => { expect(decisionJour(zeros, true)).toEqual({ http: 500, erreur: 'serie_vide' }); expect(serieVide([])).toBe(true); });
  it('cas nominal = 200', () => { expect(decisionJour(plein, true)).toEqual({ http: 200 }); });
  it('classeErreur : jamais de message brut', () => {
    expect(classeErreur(new Error('secret'))).toBe('autre');
    const e = Object.assign(new Error('x'), { name: 'ErreurPosthog', code: 'reseau' });
    expect(classeErreur(e)).toBe('reseau');
  });
  it('blocsIndisponibles liste des noms, sans données', () => {
    expect(blocsIndisponibles({ ...base(), pages: ko, entonnoir: ko })).toEqual(['pages', 'entonnoir Academy']);
    expect(blocsIndisponibles(base())).toEqual([]);
  });
});
