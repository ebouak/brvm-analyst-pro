import { describe, it, expect } from 'vitest';
import { choisirGabarit, composerRelance, piedOpposition, versHtml, estTemplateId } from './gabarits';

describe('estTemplateId', () => {
  it('accepte les cinq gabarits', () => {
    for (const id of ['paiement_inacheve', 'offre_consultee', 'actif_sans_abonnement', 'prospect_sans_compte', 'formation_gratuite']) expect(estTemplateId(id)).toBe(true);
  });
  it('refuse le reste', () => {
    for (const v of ['', 'autre', null, undefined, 3, {}]) expect(estTemplateId(v)).toBe(false);
  });
});
import { scorer } from './score';
import type { Dossier } from './types';

const MAINTENANT = new Date('2026-10-31T12:00:00Z');
const d0: Dossier = {
  cle: 'u1', emailNorm: 'awa@mail.com', userId: 'u1', nom: 'Awa Koné', inscritLe: null, derniereConnexion: null,
  premium: false, admin: false, oppose: false, paiementsEnAttente: [], paiementsReussis: [], paiements: [], offreVues: [], formationVues: [], pays: null, formationAchetee: null,
  lignesPortefeuille: 0, messages: [], prospect: null, newsletter: false, leconsAcademy: 0, actions: [],
  whatsapp: { numero: null, source: null, lieSansNumero: false, recontact: false }, bonus: [],
};
const nombres = (t: string) => t.match(/\d+/g) ?? [];

describe('choisirGabarit', () => {
  it('suit la raison principale', () => {
    const paiement = { ...d0, paiementsEnAttente: [{ montant: 5000, devise: 'XOF', date: '2026-10-12T10:00:00Z' }] };
    expect(choisirGabarit(paiement, scorer(paiement, MAINTENANT))).toBe('paiement_inacheve');
    const offre = { ...d0, offreVues: [{ page: '/pricing', jour: '2026-10-29' }] };
    expect(choisirGabarit(offre, scorer(offre, MAINTENANT))).toBe('offre_consultee');
    const formation = { ...d0, formationVues: [{ page: '/formations/academy/lecon-0', jour: '2026-10-29' }], offreVues: [{ page: '/pricing', jour: '2026-10-29' }] };
    expect(choisirGabarit(formation, scorer(formation, MAINTENANT))).toBe('formation_gratuite');
    const lecons = { ...d0, leconsAcademy: 2 };
    expect(choisirGabarit(lecons, scorer(lecons, MAINTENANT))).toBe('formation_gratuite');
    // Un paiement inachevé prime ; Premium n'est jamais ciblé.
    const paye = { ...formation, paiementsEnAttente: [{ montant: 5000, devise: 'XOF', date: '2026-10-12T10:00:00Z' }] };
    expect(choisirGabarit(paye, scorer(paye, MAINTENANT))).toBe('paiement_inacheve');
    const proprio = { ...lecons, formationAchetee: 'integrale' as const };
    expect(choisirGabarit(proprio, scorer(proprio, MAINTENANT))).not.toBe('formation_gratuite');
    const partiel = { ...lecons, formationAchetee: 'partielle' as const };
    expect(choisirGabarit(partiel, scorer(partiel, MAINTENANT))).not.toBe('formation_gratuite');
    const premium = { ...formation, premium: true };
    expect(choisirGabarit(premium, scorer(premium, MAINTENANT))).not.toBe('formation_gratuite');
    const prospect = { ...d0, userId: null, cle: 'email:awa@mail.com' };
    expect(choisirGabarit(prospect, scorer(prospect, MAINTENANT))).toBe('prospect_sans_compte');
    expect(choisirGabarit(d0, scorer(d0, MAINTENANT))).toBe('actif_sans_abonnement');
  });
});

describe('composerRelance', () => {
  it('salue par le prénom et ne cite que les chiffres du dossier', () => {
    const d = { ...d0, paiementsEnAttente: [{ montant: 5000, devise: 'XOF', date: '2026-10-12T10:00:00Z' }] };
    const { sujet, corps } = composerRelance('paiement_inacheve', d);
    expect(corps.startsWith('Bonjour Awa,')).toBe(true);
    expect(sujet.length).toBeGreaterThan(0);
    expect(nombres(corps)).toEqual(['12', '10', '5', '000']);
  });

  it('aucun autre gabarit n’invente de chiffre', () => {
    for (const id of ['offre_consultee', 'actif_sans_abonnement', 'prospect_sans_compte', 'formation_gratuite'] as const) {
      expect(nombres(composerRelance(id, d0).corps)).toEqual([]);
    }
  });

  it("affiche la devise du paiement, jamais FCFA pour de l'EUR", () => {
    const d = { ...d0, paiementsEnAttente: [{ montant: 50, devise: 'EUR', date: '2026-10-12T10:00:00Z' }] };
    const { corps } = composerRelance('paiement_inacheve', d);
    expect(corps).toContain('50 EUR');
    expect(corps).not.toContain('FCFA');
  });

  it("actif sans abonnement : vend l'Academy et Premium au mois, une seule action", () => {
    const { sujet, corps } = composerRelance('actif_sans_abonnement', d0);
    expect(sujet).toContain('Academy');
    expect(corps).toContain("l'Academy WESTBOURSE en accès complet");
    expect(corps).toContain('un mois');
    // Action principale : Premium (qui inclut l'Academy) ; porte alternative : la
    // formation complète, qui offre un mois de Premium (migration 0156).
    expect(corps.match(/https:\/\/\S+/g)).toEqual(['https://www.westbourse.com/account/plan', 'https://www.westbourse.com/formations/academy']);
    expect(corps).toContain('un mois de Premium offert');
    // Ni promesse de gain ni conseil : on décrit des outils.
    expect(corps).not.toMatch(/gagn|rentab|garanti|conseil/i);
  });

  it('formation gratuite : vend la formation complète et son mois de Premium, une seule action', () => {
    const { sujet, corps } = composerRelance('formation_gratuite', d0);
    expect(sujet).toContain('formation complète');
    expect(corps).toContain('quatre niveaux');
    expect(corps).toContain('un mois de Premium');
    expect(corps).toContain('hors refonte majeure');
    expect(corps.match(/https:\/\/\S+/g)).toEqual(['https://www.westbourse.com/formations/academy']);
    expect(corps).not.toMatch(/gagn|rentab|garanti|conseil/i);
  });

  it('salue sans prénom quand le nom manque', () => {
    expect(composerRelance('offre_consultee', { ...d0, nom: null }).corps.startsWith('Bonjour,')).toBe(true);
  });
});

describe('piedOpposition et versHtml', () => {
  it('le pied porte toujours le lien d’opposition', () => {
    expect(piedOpposition('https://www.westbourse.com/crm/opposition?t=abc')).toContain('https://www.westbourse.com/crm/opposition?t=abc');
  });
  it('échappe le HTML et rend le lien cliquable', () => {
    const html = versHtml('a <b> & c\nhttps://www.westbourse.com/crm/opposition?t=abc');
    expect(html).toContain('a &lt;b&gt; &amp; c<br>');
    expect(html).toContain('<a href="https://www.westbourse.com/crm/opposition?t=abc">');
  });
  it('le lien ne garde pas la ponctuation finale', () => {
    expect(versHtml('voir https://www.westbourse.com/signup.')).toBe('voir <a href="https://www.westbourse.com/signup">https://www.westbourse.com/signup</a>.');
  });
  it("le lien s'arrête avant une entité", () => {
    expect(versHtml('"https://x.com/a"')).toBe('&quot;<a href="https://x.com/a">https://x.com/a</a>&quot;');
  });
});
