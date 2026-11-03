import { describe, it, expect } from 'vitest';
import { nettoyerErreur, LONGUEUR_MAX_ERREUR } from './nettoyer';

describe('nettoyerErreur', () => {
  it('retire les codes de couleur du terminal', () => {
    expect(nettoyerErreur('\u001b[31mexpect(received)\u001b[39m échoue')).toBe('expect(received) échoue');
  });

  it('masque un JWT', () => {
    // Factice : en-tête {"alg":"none"}, charge {"sub":"test"}, signature inventée.
    const jwt = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0In0.signature-factice';
    expect(nettoyerErreur(`jeton ${jwt} refusé`)).toBe('jeton [masqué] refusé');
  });

  it('masque les clés Supabase de nouvelle génération', () => {
    expect(nettoyerErreur('clé sb_secret_AbC123xyz456 et sb_publishable_Zz9')).toBe('clé [masqué] et [masqué]');
  });

  it('masque un en-tête Authorization Bearer', () => {
    expect(nettoyerErreur('Authorization: Bearer abc.def-123')).toBe('Authorization: Bearer [masqué]');
  });

  it('masque la valeur des en-têtes cookie et set-cookie', () => {
    const sortie = nettoyerErreur('cookie: sb-access-token=xyz; other=1\nset-cookie: a=b; Path=/');
    expect(sortie).toBe('cookie: [masqué]\nset-cookie: [masqué]');
  });

  it('masque les paramètres sensibles d’une URL', () => {
    expect(nettoyerErreur('GET https://x.test/a?token=abc&page=2&apikey=zz&password=p')).toBe(
      'GET https://x.test/a?token=[masqué]&page=2&apikey=[masqué]&password=[masqué]',
    );
  });

  it('masque les adresses e-mail', () => {
    expect(nettoyerErreur('connexion de qa-e2e@westbourse.com refusée')).toBe('connexion de [e-mail] refusée');
  });

  it('masque une clé de type sk-', () => {
    expect(nettoyerErreur('clé sk-proj-abcdefghijklmnopqrstuv')).toBe('clé [masqué]');
  });

  it('tronque au-delà de la longueur maximale et le signale', () => {
    const sortie = nettoyerErreur('x'.repeat(LONGUEUR_MAX_ERREUR + 500)) ?? '';
    expect(sortie.length).toBeLessThanOrEqual(LONGUEUR_MAX_ERREUR);
    expect(sortie.endsWith('[tronqué]')).toBe(true);
  });

  it('renvoie null pour une erreur vide', () => {
    expect(nettoyerErreur('')).toBeNull();
    expect(nettoyerErreur(undefined)).toBeNull();
    expect(nettoyerErreur('  \n ')).toBeNull();
  });
});
