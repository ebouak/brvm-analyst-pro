import { describe, it, expect } from 'vitest';
import { libelleSuivi } from './suivi';

describe('libelleSuivi', () => {
  it('« envoyé » tant que la livraison est inconnue : jamais « reçu »', () => {
    expect(libelleSuivi({ statut: 'envoye', livraison: null }, false)).toBe('envoyé');
    expect(libelleSuivi({ statut: 'envoye' }, false)).toBe('envoyé');
    expect(libelleSuivi({ statut: 'envoye', livraison: 'envoye' }, false)).toBe('envoyé');
  });
  it('traduit chaque état de livraison', () => {
    expect(libelleSuivi({ statut: 'envoye', livraison: 'remis' }, false)).toBe('livré');
    expect(libelleSuivi({ statut: 'envoye', livraison: 'retarde' }, false)).toBe('remise retardée');
    expect(libelleSuivi({ statut: 'envoye', livraison: 'rejete' }, false)).toBe('échec');
    expect(libelleSuivi({ statut: 'envoye', livraison: 'spam' }, false)).toBe('signalé comme spam');
  });
  it('une réponse reçue après la relance l\'emporte', () => {
    expect(libelleSuivi({ statut: 'envoye', livraison: 'remis' }, true)).toBe('réponse reçue');
    expect(libelleSuivi({ statut: 'envoye', livraison: null }, true)).toBe('réponse reçue');
  });
  it('un échec d\'envoi reste un échec, même avec une réponse', () => {
    expect(libelleSuivi({ statut: 'echec', livraison: null }, true)).toBe("échec d'envoi");
  });
  it('préparé (WhatsApp) ou en cours : non envoyé, jamais « livré »', () => {
    expect(libelleSuivi({ statut: 'prepare', livraison: null }, false)).toBe('préparé, non envoyé');
    expect(libelleSuivi({ statut: 'prepare', livraison: 'remis' }, true)).toBe('préparé, non envoyé');
    expect(libelleSuivi({ statut: 'envoi', livraison: null }, false)).toBe('préparé, non envoyé');
  });
});
