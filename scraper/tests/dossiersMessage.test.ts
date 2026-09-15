import { describe, it, expect } from 'vitest';
import { composerMessage } from '../src/dossiers/message.js';
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
