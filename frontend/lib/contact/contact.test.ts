import { describe, it, expect } from 'vitest';
import { validerBrouillon } from './validerBrouillon';
import { joursOuvresEcoules, enRetard } from './delai';
import { renduReponse } from './rendu';

const SOBRE = `Bonjour Ephraim,

Investir à la BRVM passe par une SGI agréée par l'AMF-UMOA.
La liste officielle : https://www.amf-umoa.org/accueil/intervenant
Notre comparateur : https://www.westbourse.com/comparateur-sgi

Pour toute autre question : support@westbourse.com`;

describe('validerBrouillon — chaque règle vient d’un défaut réellement envoyé', () => {
  it('accepte un texte sobre, liens et adresse autorisés', () => {
    const r = validerBrouillon(SOBRE);
    expect(r.ok).toBe(true);
  });

  it.each([
    ['vide', '   '],
    ['Markdown gras (réponse du 28/09)', 'Bonjour,\nnotre application **WestBourse** vous aide.'],
    ['citation Markdown (réponse du 28/09)', '> Bonjour Madame,\nnotre application vous aide.'],
    ['titre Markdown', '# Réponse\nBonjour,'],
    ['préambule d’assistant (réponse du 22/09)', "Voici une version mise à jour de votre réponse, incluant l'appel à l'action.\n\nBonjour Hyacintha,"],
    ['séparateur d’assistant', 'Bonjour,\n-----\nObjet : Re : Contact'],
    ['téléphone international (signature du 22/09)', 'Bonjour,\nappelez le +2250707115115.'],
    ['téléphone local à 10 chiffres', 'Bonjour,\nappelez le 07 07 11 51 15.'],
    ['adresse personnelle (signature du 22/09)', 'Bonjour,\nécrivez à ebouak@gmail.com.'],
    ['lien hors domaines autorisés', 'Bonjour,\nvoyez https://exemple.com/offre.'],
    ['trop long', 'Bonjour,\n' + 'a'.repeat(4001)],
  ])('refuse : %s', (_nom, texte) => {
    const r = validerBrouillon(texte);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison.length).toBeGreaterThan(0);
  });

  it("n'assimile pas un montant à un téléphone", () => {
    const r = validerBrouillon('Bonjour,\nau-delà de 20 000 000 FCFA, une autorisation est requise.');
    expect(r.ok).toBe(true);
  });
});

describe('délai en jours ouvrés (UTC, lundi-vendredi)', () => {
  const d = (s: string) => new Date(s);
  it('vendredi 17h → lundi 9h : moins d’un jour ouvré', () => {
    expect(joursOuvresEcoules(d('2026-10-16T17:00:00Z'), d('2026-10-19T09:00:00Z'))).toBeCloseTo(16 / 24, 6);
    expect(enRetard(d('2026-10-16T17:00:00Z'), d('2026-10-19T09:00:00Z'))).toBe(false);
  });
  it('vendredi 17h → mardi 18h : en retard', () => {
    expect(enRetard(d('2026-10-16T17:00:00Z'), d('2026-10-20T18:00:00Z'))).toBe(true);
  });
  it('lundi 9h → mardi 10h : en retard', () => {
    expect(enRetard(d('2026-10-19T09:00:00Z'), d('2026-10-20T10:00:00Z'))).toBe(true);
  });
  it('samedi → lundi 8h : le week-end ne compte pas', () => {
    expect(joursOuvresEcoules(d('2026-10-17T10:00:00Z'), d('2026-10-19T08:00:00Z'))).toBeCloseTo(8 / 24, 6);
  });
});

describe('rendu de la réponse', () => {
  const r = renduReponse({
    reponse: 'Bonjour <b>Léïla</b>,\n\nVoyez https://www.westbourse.com/debutant\nMerci.',
    messageOrigine: 'quels est utilité <script>x</script>',
    recuLe: '2026-09-28T07:27:37Z',
  });
  it('échappe le HTML de la réponse et du message cité', () => {
    expect(r.html).not.toContain('<script>');
    expect(r.html).not.toContain('<b>Léïla</b>');
    expect(r.html).toContain('&lt;script&gt;');
  });
  it('rend les liens autorisés cliquables', () => {
    expect(r.html).toContain('<a href="https://www.westbourse.com/debutant"');
  });
  it('sans offre active, aucun bloc commercial', () => {
    expect(r.html).not.toContain('Pour aller plus loin');
    expect(r.text).not.toContain('Pour aller plus loin');
  });

  it('avec l’offre du catalogue : prix lu, compte requis, lien d’inscription vers l’offre', () => {
    const o = renduReponse({
      reponse: 'Bonjour,\n\nRéponse.',
      messageOrigine: 'Question',
      recuLe: '2026-10-21T08:00:00Z',
      offre: { montant: 9000, devise: 'XOF' },
    });
    for (const s of [o.html, o.text]) {
      expect(s).toContain('Pour aller plus loin');
      expect(s).toContain('9 000');
      expect(s).toContain('accès à vie');
      expect(s).toContain('1 mois Premium offert');
      expect(s).toContain('alertes');
      expect(s).toContain('https://www.westbourse.com/signup?next=%2Fformations%2Facademy');
    }
  });

  it('porte la marque : logo hébergé sur westbourse.com, nom lisible même images bloquées', () => {
    expect(r.html).toContain('src="https://www.westbourse.com/icon-192.png"');
    expect(r.html).toMatch(/>\s*WESTBOURSE\s*</);
    // Mise en page en tableaux : seule forme fiable dans Gmail et Outlook.
    expect(r.html).toContain('<table');
    // Aucune image chargée depuis un autre domaine (traceur, ressource tierce).
    for (const m of r.html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
      expect(m[1].startsWith('https://www.westbourse.com/')).toBe(true);
    }
  });

  it('porte la signature fixe, l’avertissement et la citation datée', () => {
    for (const s of [r.html, r.text]) {
      expect(s).toContain("L'équipe WESTBOURSE");
      expect(s).toContain("conseil d'investissement");
      expect(s).toContain('28/09/2026');
    }
    expect(r.subject).toBe('Re : votre message à WESTBOURSE');
  });
});
