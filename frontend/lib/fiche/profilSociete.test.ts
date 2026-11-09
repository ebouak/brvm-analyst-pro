import { describe, expect, it } from 'vitest';
import { normaliserProfil, libelleSource } from './profilSociete';

const base = {
  code: 'SGBC',
  presentation: 'Banque.',
  metiers: ['Banque de détail'],
  determinants: ['Secteur réglementé'],
  dirigeants: [
    { nom: 'Patrick BLAS', fonction: 'Directeur général', depuis: '1er mars 2024', source: 'https://institutionnel.societegenerale.ci/fr/information/' },
    { nom: 'Faman TOURÉ', fonction: "Président du Conseil d'administration", depuis: '19 mai 2021', source: 'https://www.brvm.org/x.pdf' },
  ],
  actionnariat: { lignes: [{ nom: 'SOCIETE GENERALE', pct: 55.1 }, { nom: 'BLOC FLOTTANT', pct: 43.35 }], date: '31/12/2023', source: 'https://www.brvm.org/fr/emetteurs/x' },
  site_web: 'https://societegenerale.ci/fr/',
  verifie_le: '2026-11-09',
};

describe('normaliserProfil', () => {
  it('rend null sans ligne', () => {
    expect(normaliserProfil(null)).toBeNull();
  });

  it('place la présidence avant la direction générale', () => {
    const p = normaliserProfil(base)!;
    expect(p.dirigeants.map((d) => d.nom)).toEqual(['Faman TOURÉ', 'Patrick BLAS']);
  });

  it('trie l’actionnariat par part décroissante et garde la date', () => {
    const p = normaliserProfil(base)!;
    expect(p.actionnariat!.lignes[0].nom).toBe('SOCIETE GENERALE');
    expect(p.actionnariat!.date).toBe('31/12/2023');
  });

  it('écarte un dirigeant sans source ou sans nom', () => {
    const p = normaliserProfil({ ...base, dirigeants: [{ nom: 'X', fonction: 'DG', source: '' }, { nom: '', fonction: 'DG', source: 'https://brvm.org' }] })!;
    expect(p.dirigeants).toEqual([]);
  });

  it('écarte un actionnariat dont les parts dépassent 100,5 %', () => {
    const p = normaliserProfil({ ...base, actionnariat: { lignes: [{ nom: 'A', pct: 61 }, { nom: 'B', pct: 26 }, { nom: 'C', pct: 23 }], date: '31/12/2025', source: 'https://brvm.org' } })!;
    expect(p.actionnariat).toBeNull();
  });

  it('écarte un site web qui pointe vers un tiers de données', () => {
    const p = normaliserProfil({ ...base, site_web: 'https://www.richbourse.com/x' })!;
    expect(p.siteWeb).toBeNull();
  });
});

describe('identité', () => {
  it('garde capital, introduction et fractionnements valides', () => {
    const p = normaliserProfil({ ...base, historique: 'Créée en 1962.', identite: { raison_sociale: 'SG CI', isin: 'CI0000000030', introduction: '1998-09-16', capital: { montant: 15555555000, nominal: 500 }, siege: 'Plateau, Abidjan', fractionnements: [{ date: '2017-08-25', parite: '10 pour 1' }, { date: '25 août', parite: 'x' }] } })!;
    expect(p.historique).toBe('Créée en 1962.');
    expect(p.identite!.capital!.nominal).toBe(500);
    expect(p.identite!.fractionnements).toHaveLength(1);
  });
  it('refuse un siège portant un courriel ou un téléphone', () => {
    const p = normaliserProfil({ ...base, identite: { siege: 'contact@x.ci Abidjan' } })!;
    expect(p.identite).toBeNull();
    const q = normaliserProfil({ ...base, identite: { siege: 'Abidjan 27 20 32 66', isin: 'CI1' } })!;
    expect(q.identite!.siege).toBeNull();
  });
});

describe('libelleSource', () => {
  it('nomme la BRVM et garde le domaine sinon', () => {
    expect(libelleSource('https://www.brvm.org/fr/x')).toBe('BRVM');
    expect(libelleSource('https://institutionnel.societegenerale.ci/fr')).toBe('institutionnel.societegenerale.ci');
    expect(libelleSource('pas une url')).toBe('source');
  });
});
