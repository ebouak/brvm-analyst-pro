import { describe, it, expect } from 'vitest';
import { composerInvitation, composerMessage, composerRectificatif } from '../src/dossiers/message.js';
import type { Selection } from '../src/dossiers/selection.js';

const sel: Selection = {
  retenues: [
    { code: 'NEIC', designation: 'NEI CEDA CI', valorisation: 27500 },
    { code: 'SGBC', designation: 'SOCIETE GENERALE CI', valorisation: 15000 },
  ],
  exclues: [{ code: 'SVOC', designation: 'SOLIBRA', raison: 'dossier de cette semaine non disponible' }],
  pieces_jointes_email: [{ code: 'NEIC', designation: 'NEI CEDA CI', valorisation: 27500 }],
  reste_email: [{ code: 'SGBC', designation: 'SOCIETE GENERALE CI', valorisation: 15000 }],
};

describe('composerMessage', () => {
  const m = composerMessage(sel, '2026-09-14', 'email');

  it('date le sujet du lundi de la semaine', () => {
    expect(m.sujet).toBe('Vos dossiers valeur — semaine du 14/09/2026');
  });

  it('liste les pièces jointes, renvoie le reste au portefeuille, nomme les exclus', () => {
    expect(m.corps).toContain('NEIC — NEI CEDA CI');
    expect(m.corps).toContain('SGBC — SOCIETE GENERALE CI');
    expect(m.corps).toContain('/portefeuille');
    expect(m.corps).toContain('SVOC — SOLIBRA : dossier de cette semaine non disponible');
  });

  it('porte le cadre réglementaire et le rappel de retrait', () => {
    expect(m.corps).toContain('ne constitue pas un conseil en investissement');
    expect(m.corps).toContain('Paramètres');
  });

  /**
   * LA RÈGLE CENTRALE. Les chiffres vivent dans les PDF, déjà vérifiés ligne à
   * ligne. En remettre dans le corps du message créerait une seconde source à
   * tenir juste — et un jour elle divergerait. Ce test échoue à la moindre
   * valeur numérique réintroduite dans le gabarit.
   */
  it('AUCUN chiffre dans le corps, hors dates JJ/MM/AAAA', () => {
    const sansDates = m.corps.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, '');
    expect(sansDates).not.toMatch(/\d/);
  });

  it('en Telegram : pas de plafond, toutes les retenues, aucun renvoi au portefeuille', () => {
    const t = composerMessage(sel, '2026-09-14', 'telegram');
    expect(t.corps).toContain('NEIC — NEI CEDA CI');
    expect(t.corps).toContain('SGBC — SOCIETE GENERALE CI');
    expect(t.corps).not.toContain('/portefeuille');
  });

  it('sans exclu, aucune rubrique « non envoyés »', () => {
    const propre: Selection = { ...sel, exclues: [] };
    expect(composerMessage(propre, '2026-09-14', 'email').corps).not.toContain('Non envoyés');
  });

  it('sans reste, aucun renvoi au portefeuille', () => {
    const court: Selection = { ...sel, reste_email: [] };
    expect(composerMessage(court, '2026-09-14', 'email').corps).not.toContain('/portefeuille');
  });
});

describe('composerRectificatif', () => {
  const r = composerRectificatif(sel, '2026-10-05', 'email');

  it('annonce un rectificatif daté de la semaine de l’envoi fautif', () => {
    expect(r.sujet).toBe('Rectificatif — vos dossiers valeur de la semaine du 05/10/2026');
  });

  it('dit que les pièces jointes REMPLACENT les précédentes et ce qui était faux, sans chiffre', () => {
    expect(r.corps).toContain('remplacent');
    expect(r.corps).toContain('trimestre');
    expect(r.corps).toContain('NEIC — NEI CEDA CI');
    expect(r.corps).toContain('ne constitue pas un conseil en investissement');
  });

  it('AUCUN chiffre dans le corps, hors dates JJ/MM/AAAA', () => {
    for (const canal of ['email', 'telegram'] as const) {
      const sansDates = composerRectificatif(sel, '2026-10-05', canal).corps.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, '');
      expect(sansDates).not.toMatch(/\d/);
    }
  });
});

describe('composerInvitation', () => {
  const inv = composerInvitation([{ code: 'NEIC', designation: 'NEI CEDA CI' }]);
  it('dit que les dossiers sont réservés au Premium et donne le lien', () => {
    expect(inv.sujet).toMatch(/Premium/);
    expect(inv.corps).toContain('https://www.westbourse.com/account/plan');
  });
  it('nomme les valeurs du portefeuille et donne le moyen de ne plus le recevoir', () => {
    expect(inv.corps).toContain('NEIC — NEI CEDA CI');
    expect(inv.corps).toContain('/parametres/alertes');
  });
  it('AUCUN chiffre, aucune pièce jointe annoncée', () => {
    expect(inv.corps).not.toMatch(/\d/);
    expect(inv.corps).not.toMatch(/ci-joint/i);
  });
  it('portefeuille vide : pas de liste', () => {
    expect(composerInvitation([]).corps).not.toContain('•');
  });
});

describe('composerMessage : revues de résultats mises à jour', () => {
  const revues = [{ code: 'NEIC', designation: 'NEI CEDA CI', publie_le: '2026-11-10' }];
  it('annonce la Revue mise à jour avec la date de publication et le lien', () => {
    const m = composerMessage(sel, '2026-11-09', 'email', revues);
    expect(m.corps).toContain('Revues de résultats mises à jour');
    expect(m.corps).toContain('publication du 10/11/2026');
    expect(m.corps).toContain('https://www.westbourse.com/actions/NEIC/revue');
  });
  it('AUCUN chiffre hors dates, même avec la rubrique', () => {
    for (const canal of ['email', 'telegram'] as const) {
      const sansDates = composerMessage(sel, '2026-11-09', canal, revues).corps.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, '');
      expect(sansDates).not.toMatch(/\d/);
    }
  });
  it('sans mise à jour, aucune rubrique', () => {
    expect(composerMessage(sel, '2026-11-09', 'email').corps).not.toContain('Revues de résultats');
  });
});
