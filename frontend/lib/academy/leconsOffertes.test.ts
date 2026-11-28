import { describe, expect, it } from 'vitest';
import { accesOffert, LECONS_OFFERTES, leconOuverte, lienOffre, offreDuCours } from './leconsOffertes';

const N1 = 'academy-niveau-1-initiation';
const N2 = 'academy-niveau-2-fondamental';

describe('accesOffert', () => {
  it('ouvre la Leçon 1 du Niveau 1 à tous', () => {
    expect(accesOffert(N1, 'Leçon 1 — Qu’est-ce que la BRVM et comment ça marche ?')).toBe('public');
  });

  it('ne confond pas la Leçon 1 avec la Leçon 10 ou 11', () => {
    expect(accesOffert(N1, 'Leçon 10 — Investir depuis l’étranger (diaspora)')).toBeNull();
    expect(accesOffert(N1, 'Leçon 11 — BRVM ou autres placements')).toBeNull();
    expect(accesOffert(N1, 'Leçon 2 — Les 4 acteurs clés du marché')).toBeNull();
  });

  it('offre le cas Sonatel du Niveau 2 avec un compte', () => {
    expect(accesOffert(N2, 'Leçon 1 — Lire un rapport annuel')).toBe('compte');
  });

  it('suit la leçon par son titre, pas par sa position', () => {
    // Le Module 0 a inséré huit leçons « 0.x » avant elle : aucune n'est offerte.
    expect(accesOffert(N2, 'Leçon 0.1 — Le principe, le marché BRVM et les sources')).toBeNull();
    expect(accesOffert(N2, 'Leçon 0.7 — Télécoms : Sonatel face à Orange Côte d’Ivoire')).toBeNull();
    expect(accesOffert(N2, 'Leçon 2 — Le PER : évaluer la cherté d’une action')).toBeNull();
  });

  it('tolère tiret court, espaces et casse, pas un autre titre', () => {
    expect(accesOffert(N2, '  leçon 1 – Lire  un rapport annuel : Sonatel 2025')).toBe('compte');
    expect(accesOffert(N2, 'Leçon 1 — Lire un bilan')).toBeNull();
  });

  it('n’ouvre rien hors des cours désignés ni sans titre', () => {
    expect(accesOffert('academy-niveau-3-technique', 'Leçon 1 — Lire un graphique de cours')).toBeNull();
    expect(accesOffert('academy-niveau-4-expert', 'Leçon 1 — L’architecture du marché')).toBeNull();
    expect(accesOffert(N2, null)).toBeNull();
    expect(accesOffert(N2, '')).toBeNull();
  });
});

describe('leconOuverte', () => {
  it('public : ouverte avec ou sans session', () => {
    expect(leconOuverte('public', false)).toBe(true);
    expect(leconOuverte('public', true)).toBe(true);
  });

  it('compte : ouverte seulement avec une session', () => {
    expect(leconOuverte('compte', false)).toBe(false);
    expect(leconOuverte('compte', true)).toBe(true);
  });

  it('leçon non offerte : fermée même connecté', () => {
    expect(leconOuverte(null, true)).toBe(false);
  });
});

describe('offreDuCours & lienOffre', () => {
  it('une seule offre par cours, liens vers la bonne position', () => {
    const slugs = LECONS_OFFERTES.map((o) => o.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(lienOffre(offreDuCours(N1)!)).toBe(`/formations/academy/${N1}?lecon=1`);
    expect(lienOffre(offreDuCours(N2)!)).toBe(`/formations/academy/${N2}?lecon=9`);
    expect(offreDuCours('academy-niveau-3-technique')).toBeNull();
  });
});
