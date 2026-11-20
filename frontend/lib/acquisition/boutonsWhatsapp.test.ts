import { describe, it, expect } from 'vitest';
import { CHEMIN_ALERTES, lienAlertesWhatsapp, lienEcrireWhatsapp } from './boutonsWhatsapp';
import { destinationInscritConnecte } from '@/lib/auth/urlsAcces';

describe('lienEcrireWhatsapp', () => {
  it('ne garde que les chiffres et préremplit AIDE', () => {
    expect(lienEcrireWhatsapp('+33 7 43 65 72 71')).toBe('https://wa.me/33743657271?text=AIDE');
    expect(lienEcrireWhatsapp('33743657271')).toBe('https://wa.me/33743657271?text=AIDE');
  });
  it('sans numéro exploitable : null (le bouton ne s affiche pas)', () => {
    expect(lienEcrireWhatsapp(undefined)).toBeNull();
    expect(lienEcrireWhatsapp(null)).toBeNull();
    expect(lienEcrireWhatsapp('')).toBeNull();
    expect(lienEcrireWhatsapp('  + ')).toBeNull();
    expect(lienEcrireWhatsapp('1234')).toBeNull();
    expect(lienEcrireWhatsapp('1'.repeat(16))).toBeNull();
  });
});

describe('lienAlertesWhatsapp', () => {
  it('anonyme : inscription attribuée à la source, puis la page des alertes', () => {
    const u = lienAlertesWhatsapp('accueil');
    expect(u).toBe('/signup?src=accueil&next=%2Fparametres%2Falertes');
    const p = new URL(u, 'http://x');
    expect(p.pathname).toBe('/signup');
    expect(p.searchParams.get('src')).toBe('accueil');
    expect(p.searchParams.get('next')).toBe(CHEMIN_ALERTES);
  });
  it('source normalisée comme le compteur (invalide = inconnu)', () => {
    expect(lienAlertesWhatsapp(' Article ')).toContain('src=article&');
    expect(lienAlertesWhatsapp('<script>')).toContain('src=inconnu&');
  });
  it('connecté : directement la page des alertes', () => {
    expect(lienAlertesWhatsapp('dashboard', true)).toBe('/parametres/alertes');
  });
});

describe('destinationInscritConnecte', () => {
  it('/signup avec next sûr : renvoie vers next', () => {
    expect(destinationInscritConnecte('/signup', '/parametres/alertes')).toBe('/parametres/alertes');
  });
  it('/signup sans next : null, la page reste affichée', () => {
    expect(destinationInscritConnecte('/signup', null)).toBeNull();
    expect(destinationInscritConnecte('/signup', '')).toBeNull();
  });
  it('next externe ou piégé : null', () => {
    expect(destinationInscritConnecte('/signup', '//evil.com')).toBeNull();
    expect(destinationInscritConnecte('/signup', 'https://evil.com')).toBeNull();
    expect(destinationInscritConnecte('/signup', '/\t/evil.com')).toBeNull();
    expect(destinationInscritConnecte('/signup', '/\\evil.com')).toBeNull();
  });
  it('autre chemin : null', () => {
    expect(destinationInscritConnecte('/login', '/parametres/alertes')).toBeNull();
    expect(destinationInscritConnecte('/signup/x', '/parametres/alertes')).toBeNull();
  });
});
