import { describe, expect, it } from 'vitest';
import {
  composerEmailRelanceAcademy,
  dansFenetreDeRelance,
  estJetonArret,
  selectionnerRelancesAcademy,
  statutsCooldown,
  type CandidatRelanceAcademy,
  type RelanceSelectionnee,
} from './relanceProgression';

const JETON = 'a'.repeat(48);

const NOW = new Date('2026-11-25T10:00:00Z');

function base(overrides: Partial<CandidatRelanceAcademy> = {}): CandidatRelanceAcademy {
  return {
    userId: 'u-1',
    email: 'investisseur@example.com',
    displayName: 'Aminata',
    courseSlug: 'academy-niveau-1-initiation',
    courseTitre: 'Niveau 1 — Initiation à la BRVM',
    niveau: 'debutant',
    doneLessons: 9,
    totalLessons: 11,
    nextLessonIdx: 9,
    nextLessonTitle: 'Leçon 10 — Lire un avis financier',
    lastActivityAt: '2026-11-18T10:00:00Z', // J+7
    examPassed: false,
    oppose: false,
    lastReminderAt: null,
    ...overrides,
  };
}

describe('Academy relances progression J+5 (Lot #6)', () => {
  it('filtre strictement les fenêtres d’inactivité, oppositions, examens réussis et cooldown 14j', () => {
    const candidats: CandidatRelanceAcademy[] = [
      base({ userId: 'trop-recent', lastActivityAt: '2026-11-22T10:00:00Z' }), // J+3 -> ignoré
      base({ userId: 'trop-ancien', lastActivityAt: '2026-10-01T10:00:00Z' }), // J+55 -> ignoré
      base({ userId: 'deja-fini', doneLessons: 11, totalLessons: 11 }),
      base({ userId: 'pas-entame', doneLessons: 0 }),
      base({ userId: 'examen-ok', examPassed: true }),
      base({ userId: 'oppose', oppose: true }),
      base({ userId: 'cooldown', lastReminderAt: '2026-11-15T10:00:00Z' }), // 10j < 14j -> ignoré
      base({ userId: 'eligible-cooldown-ok', lastReminderAt: '2026-11-05T10:00:00Z', doneLessons: 10 }), // 20j >= 14j
      base({ userId: 'eligible-j7', doneLessons: 8 }),
    ];

    const out = selectionnerRelancesAcademy(candidats, NOW, 30);
    expect(out.map((x) => x.userId)).toEqual(['eligible-cooldown-ok', 'eligible-j7']);
    expect(out[0]?.remainingLessons).toBe(1);
    expect(out[1]?.remainingLessons).toBe(3);
  });

  it('déduplique par utilisateur en gardant le cours le plus proche de la fin et applique le plafond', () => {
    const out = selectionnerRelancesAcademy(
      [
        base({ userId: 'u-1', courseSlug: 'academy-niveau-2-fondamental', doneLessons: 10, totalLessons: 18 }),
        base({ userId: 'u-1', courseSlug: 'academy-niveau-1-initiation', doneLessons: 10, totalLessons: 11 }),
        base({ userId: 'u-2', doneLessons: 9, totalLessons: 11 }),
      ],
      NOW,
      1,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.userId).toBe('u-1');
    expect(out[0]?.courseSlug).toBe('academy-niveau-1-initiation');
  });

  it('compose un e-mail avec lien ?lecon=N, objet adapté et échappement HTML', () => {
    const mail = composerEmailRelanceAcademy(cible({ displayName: '<Moussa>', nextLessonTitle: 'Leçon 11 & bilan' }), { jetonArret: JETON });
    expect(mail.resumeUrl).toBe('https://www.westbourse.com/formations/academy/academy-niveau-1-initiation?lecon=11');
    expect(mail.subject).toContain('Plus qu’une leçon');
    expect(mail.html).not.toContain('<Moussa>');
    expect(mail.html).toContain('&lt;Moussa&gt;');
    expect(mail.html).toContain('Leçon 11 &amp; bilan');
  });

  it('porte un retrait en un clic (RFC 8058) et un lien d’arrêt dans le corps', () => {
    const mail = composerEmailRelanceAcademy(cible(), { jetonArret: JETON, siteUrl: 'https://www.westbourse.com/' });
    expect(mail.headers['List-Unsubscribe']).toBe(`<https://www.westbourse.com/api/academy/rappels/arret?t=${JETON}>`);
    expect(mail.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(mail.html).toContain(`https://www.westbourse.com/academy/rappels/arret?t=${JETON}`);
    expect(mail.text).toContain(`Ne plus recevoir ces rappels : https://www.westbourse.com/academy/rappels/arret?t=${JETON}`);
    expect(mail.text).toContain('https://www.westbourse.com/parametres/alertes');
  });

  it('refuse de composer sans jeton d’arrêt valide (échec fermé)', () => {
    for (const j of ['', 'abc', 'A'.repeat(48), `${'a'.repeat(47)}g`]) {
      expect(() => composerEmailRelanceAcademy(cible(), { jetonArret: j })).toThrow();
    }
    expect(estJetonArret(JETON)).toBe(true);
    expect(estJetonArret(null)).toBe(false);
  });

  it('délai de 14 jours : « envoi » (peut-être parti) compte, « echec » non ; la simulation ne bloque pas le réel', () => {
    expect(statutsCooldown('actif')).toEqual(['envoi', 'envoye']);
    expect(statutsCooldown('simulation')).toEqual(['simulation', 'envoi', 'envoye']);
  });

  it('une seule règle de fenêtre pour le tri préalable et la sélection', () => {
    expect(dansFenetreDeRelance('2026-11-18T10:00:00Z', null, NOW)).toBe(true); // J+7
    expect(dansFenetreDeRelance('2026-11-21T10:00:00Z', null, NOW)).toBe(false); // J+4
    expect(dansFenetreDeRelance('2026-10-10T10:00:00Z', null, NOW)).toBe(false); // J+46
    expect(dansFenetreDeRelance('pas une date', null, NOW)).toBe(false);
    expect(dansFenetreDeRelance('2026-11-18T10:00:00Z', '2026-11-12T10:00:00Z', NOW)).toBe(false); // 13 j
    expect(dansFenetreDeRelance('2026-11-18T10:00:00Z', '2026-11-11T10:00:00Z', NOW)).toBe(true); // 14 j
  });
});

function cible(overrides: Partial<RelanceSelectionnee> = {}): RelanceSelectionnee {
  return {
    userId: 'u-1',
    email: 'a@b.ci',
    displayName: 'Moussa',
    courseSlug: 'academy-niveau-1-initiation',
    courseTitre: 'Niveau 1',
    niveau: 'debutant',
    doneLessons: 10,
    totalLessons: 11,
    remainingLessons: 1,
    nextLessonIdx: 10,
    nextLessonTitle: 'Leçon 11',
    joursInactif: 7,
    ...overrides,
  };
}
