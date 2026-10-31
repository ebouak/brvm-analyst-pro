import { describe, it, expect } from 'vitest';
import { choisirGabarit, composerRelance, piedOpposition, versHtml } from './gabarits';
import { scorer } from './score';
import type { Dossier } from './types';

const MAINTENANT = new Date('2026-10-31T12:00:00Z');
const d0: Dossier = {
  cle: 'u1', emailNorm: 'awa@mail.com', userId: 'u1', nom: 'Awa Koné', inscritLe: null, derniereConnexion: null,
  premium: false, admin: false, oppose: false, paiementsEnAttente: [], paiementsReussis: [], offreVues: [],
  lignesPortefeuille: 0, messages: [], prospect: null, newsletter: false, leconsAcademy: 0, actions: [],
};
const nombres = (t: string) => t.match(/\d+/g) ?? [];

describe('choisirGabarit', () => {
  it('suit la raison principale', () => {
    const paiement = { ...d0, paiementsEnAttente: [{ montant: 5000, devise: 'XOF', date: '2026-10-12T10:00:00Z' }] };
    expect(choisirGabarit(paiement, scorer(paiement, MAINTENANT))).toBe('paiement_inacheve');
    const offre = { ...d0, offreVues: [{ page: '/pricing', jour: '2026-10-29' }] };
    expect(choisirGabarit(offre, scorer(offre, MAINTENANT))).toBe('offre_consultee');
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
    expect(nombres(corps).every((n) => ['12', '10', '5', '000'].includes(n))).toBe(true);
  });

  it('aucun autre gabarit n’invente de chiffre', () => {
    for (const id of ['offre_consultee', 'actif_sans_abonnement', 'prospect_sans_compte'] as const) {
      expect(nombres(composerRelance(id, d0).corps)).toEqual([]);
    }
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
});
