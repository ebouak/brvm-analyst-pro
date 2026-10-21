import { describe, it, expect } from 'vitest';
import { composerRappel, joursOuvresEcoules } from '../src/contact/rappel.js';

const MARDI_10H = new Date('2026-10-20T10:00:00Z');

describe('relance des messages de contact sans réponse', () => {
  it('rien à signaler sans message en attente', () => {
    expect(composerRappel([], MARDI_10H)).toBeNull();
  });

  it('rien à signaler tant qu’aucun message n’a dépassé un jour ouvré', () => {
    // lundi 12h → mardi 10h = 22 h ouvrées : pas encore en retard.
    expect(composerRappel([{ created_at: '2026-10-19T12:00:00Z' }], MARDI_10H)).toBeNull();
  });

  it('signale le nombre et l’ancienneté, sans aucune donnée personnelle', () => {
    const r = composerRappel(
      [{ created_at: '2026-10-14T16:06:53Z' }, { created_at: '2026-10-19T12:00:00Z' }],
      MARDI_10H,
    );
    expect(r).not.toBeNull();
    expect(r!.enRetard).toBe(1);
    expect(r!.texte).toContain('1 message');
    expect(r!.texte).toContain('https://www.westbourse.com/admin/contact');
    expect(r!.texte).not.toMatch(/@/);
  });

  it('le week-end ne compte pas', () => {
    expect(joursOuvresEcoules(new Date('2026-10-17T10:00:00Z'), new Date('2026-10-19T08:00:00Z'))).toBeCloseTo(8 / 24, 6);
  });
});
