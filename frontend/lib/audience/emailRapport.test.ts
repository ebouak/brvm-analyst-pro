import { describe, it, expect } from 'vitest';
import { construireEmailRapport } from './emailRapport';
import type { Audience } from './types';

const ok = <T,>(data: T) => ({ ok: true as const, data });
const a: Audience = {
  debut: '', fin: '',
  overview: ok({ evenements: 1, pagesVues: 50, personnes: 20, sessions: 30 }),
  overviewPrecedent: ok({ evenements: 1, pagesVues: 40, personnes: 10, sessions: 30 }),
  continents: ok([{ code: 'AF', nom: 'Afrique', personnes: 8, sessions: 9 }]),
  continentsPrecedent: ok([]),
  pays: ok([{ code: 'SN', nom: 'Sénégal', personnes: 4, sessions: 5, uemoa: true }]),
  villes: ok([]), sessions: ok({ sessions: 30, dureeMoyenneS: null, dureeMedianeS: null, pagesParSession: null }),
  pages: ok([{ chemin: '/<script>x', vues: 9, personnes: 5 }]), clics: ok([]), appareils: ok([]), tendance: ok([]),
  entonnoir: ok({ academy: 6, lecon: 3, inscription: 1 }),
  formationCrm: { ok: false, erreur: 'crm' },
};

describe('construireEmailRapport', () => {
  const r = construireEmailRapport({ periode: 'semaine', libelleFenetre: '26 oct. → 1 nov. 2026', a, lien: 'https://www.westbourse.com/admin/audience/rapport?periode=semaine' });
  it('sujet, Δ, Afrique/UEMOA et lien', () => {
    expect(r.sujet).toContain('hebdomadaire');
    expect(r.html).toContain('+100 %');
    expect(r.html).toContain('dont UEMOA');
    expect(r.html).toContain('rapport?periode=semaine');
  });
  it('échappe les chemins venus de PostHog', () => {
    expect(r.html).not.toContain('<script>');
    expect(r.html).toContain('&lt;script&gt;');
  });
  it('bloc indisponible déclaré, mention cookies présente, pas de pixel', () => {
    expect(r.html).toContain('indisponible');
    expect(r.html).toContain('cookies de mesure');
    expect(r.html).not.toMatch(/<img/i);
    expect(r.text).toContain('Rapport complet');
  });
});
