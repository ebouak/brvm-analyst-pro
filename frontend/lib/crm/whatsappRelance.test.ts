import { describe, it, expect } from 'vitest';
import { avecMentionStop, lienWaMeVers, estStop, MENTION_STOP, texteOffre, texteWhatsappInitial } from './whatsappRelance';

describe('whatsappRelance', () => {
  it('ajoute la mention STOP si elle manque, une seule fois', () => {
    expect(avecMentionStop('Bonjour')).toBe(`Bonjour\n\n${MENTION_STOP}`);
    expect(avecMentionStop(`Bonjour\n\n${MENTION_STOP}`)).toBe(`Bonjour\n\n${MENTION_STOP}`);
  });
  it('construit un lien wa.me vers le numéro E.164', () => {
    expect(lienWaMeVers('+2250707123456', 'Salut & bienvenue')).toBe('https://wa.me/2250707123456?text=Salut%20%26%20bienvenue');
  });
  it('reconnaît STOP et ses variantes, rien d’autre', () => {
    for (const t of ['STOP', ' stop ', 'Stop.', 'ARRET', 'arrêt', '/stop', 'Stop !', 'STOP,', 'STOP 🛑', 'stop!!']) expect(estStop(t)).toBe(true);
    for (const t of ['Stop svp', 'stop les alertes demain', 'cours SNTS', 'arrêtez de m’écrire svp', '']) expect(estStop(t)).toBe(false);
  });
  it("le texte d'offre porte le lien", () => {
    expect(texteOffre('https://x/offre?t=1')).toContain('https://x/offre?t=1');
  });
});

describe('texteWhatsappInitial', () => {
  it('salue par le prénom si connu, sinon sans', () => {
    expect(texteWhatsappInitial('Awa')).toMatch(/^Bonjour Awa,/);
    expect(texteWhatsappInitial(null)).toMatch(/^Bonjour, /);
  });
  it('ne contient aucun chiffre (ni montant, ni date)', () => {
    expect(texteWhatsappInitial('Awa')).not.toMatch(/\d/);
    expect(texteWhatsappInitial(null)).not.toMatch(/\d/);
  });
});
