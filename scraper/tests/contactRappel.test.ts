import { describe, it, expect } from 'vitest';
import { composerRappel, joursOuvresEcoules, type LigneContact } from '../src/contact/rappel.js';

const MARDI_10H = new Date('2026-10-20T10:00:00Z');
const ligne = (p: Partial<LigneContact>): LigneContact => ({
  id: p.id ?? 'id',
  statut: p.statut ?? 'nouveau',
  created_at: p.created_at ?? '2026-10-20T09:00:00Z',
  repondu_at: p.repondu_at ?? null,
  livraison: p.livraison ?? null,
  livraison_alerte_at: p.livraison_alerte_at ?? null,
});

describe('contrôle des réponses du formulaire de contact', () => {
  it('rien à signaler quand tout est en ordre', () => {
    expect(composerRappel([], MARDI_10H)).toBeNull();
    expect(
      composerRappel(
        [
          ligne({ created_at: '2026-10-19T12:00:00Z' }), // 22 h ouvrées : pas encore en retard
          ligne({ statut: 'repondu', repondu_at: '2026-10-19T08:00:00Z', livraison: 'remis' }),
        ],
        MARDI_10H,
      ),
    ).toBeNull();
  });

  it('signale une demande sans réponse depuis plus d’un jour ouvré', () => {
    const r = composerRappel([ligne({ created_at: '2026-10-14T16:06:53Z' })], MARDI_10H);
    expect(r!.enRetard).toBe(1);
    expect(r!.texte).toContain('sans réponse');
  });

  it('signale une réponse rejetée ou signalée comme spam, une seule fois', () => {
    const r = composerRappel(
      [
        ligne({ id: 'a', statut: 'repondu', repondu_at: '2026-10-20T08:00:00Z', livraison: 'rejete' }),
        ligne({ id: 'b', statut: 'repondu', repondu_at: '2026-10-20T08:00:00Z', livraison: 'spam' }),
        ligne({ id: 'c', statut: 'repondu', repondu_at: '2026-10-20T08:00:00Z', livraison: 'rejete', livraison_alerte_at: '2026-10-20T09:00:00Z' }),
      ],
      MARDI_10H,
    );
    expect(r!.nonRemisIds).toEqual(['a', 'b']);
    expect(r!.texte).toContain("n'est pas arrivée");
  });

  it('signale une remise non confirmée après 24 h (webhook muet), pas avant', () => {
    expect(
      composerRappel([ligne({ statut: 'repondu', repondu_at: '2026-10-20T08:00:00Z', livraison: 'envoye' })], MARDI_10H),
    ).toBeNull();
    const r = composerRappel(
      [ligne({ statut: 'repondu', repondu_at: '2026-10-18T08:00:00Z', livraison: 'envoye' })],
      MARDI_10H,
    );
    expect(r!.nonConfirmes).toBe(1);
    expect(r!.texte).toContain('remise non confirmée');
  });

  it('ignore une réponse envoyée avant le suivi de livraison (statut absent)', () => {
    expect(
      composerRappel([ligne({ statut: 'repondu', repondu_at: '2026-10-18T08:00:00Z', livraison: null })], MARDI_10H),
    ).toBeNull();
  });

  it('signale un envoi resté bloqué', () => {
    const r = composerRappel([ligne({ statut: 'envoi' })], MARDI_10H);
    expect(r!.bloques).toBe(1);
  });

  it('ne contient aucune donnée personnelle', () => {
    const r = composerRappel(
      [
        ligne({ created_at: '2026-10-14T16:06:53Z' }),
        ligne({ id: 'a', statut: 'repondu', repondu_at: '2026-10-20T08:00:00Z', livraison: 'rejete' }),
      ],
      MARDI_10H,
    );
    expect(r!.texte).not.toMatch(/@/);
    expect(r!.texte).toContain('https://www.westbourse.com/admin/contact');
  });

  it('le week-end ne compte pas', () => {
    expect(joursOuvresEcoules(new Date('2026-10-17T10:00:00Z'), new Date('2026-10-19T08:00:00Z'))).toBeCloseTo(8 / 24, 6);
  });
});
