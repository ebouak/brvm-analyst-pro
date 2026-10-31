import { describe, it, expect } from 'vitest';
import { assemblerDossiers, normaliserEmail, chronologie, type Sources } from './identite';

const vide: Sources = {
  comptes: [], profils: [], admins: [], paiements: [], signaux: [], positions: [],
  messages: [], prospects: [], newsletter: [], academy: [], actions: [], oppositions: [],
};

describe('normaliserEmail', () => {
  it('met en minuscules et retire les espaces', () => {
    expect(normaliserEmail('  Awa.K@Mail.COM ')).toBe('awa.k@mail.com');
    expect(normaliserEmail(null)).toBe('');
  });
});

describe('assemblerDossiers', () => {
  it('rattache au compte, par e-mail normalisé, le prospect, la newsletter et les messages', () => {
    const d = assemblerDossiers({
      ...vide,
      comptes: [{ id: 'u1', email: 'Awa@mail.com', created_at: '2026-09-01T10:00:00Z', last_sign_in_at: '2026-10-30T10:00:00Z' }],
      profils: [{ id: 'u1', display_name: 'Awa Koné', is_premium: false }],
      prospects: [{ email: 'awa@MAIL.com ', nom: 'Awa', created_at: '2026-08-01T10:00:00Z', consent: true }],
      newsletter: [{ email: 'awa@mail.com', confirmed: true }],
      messages: [{ email: 'awa@mail.com', created_at: '2026-10-25T10:00:00Z' }],
    });
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ cle: 'u1', emailNorm: 'awa@mail.com', nom: 'Awa Koné', newsletter: true, prospect: { consent: true } });
    expect(d[0]!.messages).toEqual([{ date: '2026-10-25T10:00:00Z' }]);
  });

  it('crée un dossier « prospect sans compte » seulement avec consentement ou newsletter confirmée', () => {
    const d = assemblerDossiers({
      ...vide,
      prospects: [
        { email: 'oui@mail.com', nom: 'Oui', created_at: '2026-10-01T10:00:00Z', consent: true },
        { email: 'non@mail.com', nom: 'Non', created_at: '2026-10-01T10:00:00Z', consent: false },
      ],
      newsletter: [{ email: 'lecteur@mail.com', confirmed: true }, { email: 'pasconfirme@mail.com', confirmed: false }],
    });
    expect(d.map((x) => x.cle).sort()).toEqual(['email:lecteur@mail.com', 'email:oui@mail.com']);
    expect(d.find((x) => x.cle === 'email:oui@mail.com')!.userId).toBeNull();
  });

  it('marque premium, admin et opposition ; compte paiements, portefeuille et Academy', () => {
    const [d] = assemblerDossiers({
      ...vide,
      comptes: [{ id: 'u1', email: 'a@b.c', created_at: null, last_sign_in_at: null }],
      profils: [{ id: 'u1', display_name: null, is_premium: true }],
      admins: [{ user_id: 'u1' }],
      oppositions: [{ email_norm: 'a@b.c' }],
      paiements: [
        { user_id: 'u1', amount: '5000', currency: 'XOF', status: 'pending', created_at: '2026-10-12T10:00:00Z', paid_at: null },
        { user_id: 'u1', amount: 5000, currency: 'XOF', status: 'paid', created_at: '2026-09-01T10:00:00Z', paid_at: '2026-09-01T11:00:00Z' },
      ],
      positions: [{ user_id: 'u1' }, { user_id: 'u1' }],
      academy: [{ user_id: 'u1', completed: true }, { user_id: 'u1', completed: false }],
    });
    expect(d).toMatchObject({ premium: true, admin: true, oppose: true, lignesPortefeuille: 2, leconsAcademy: 1 });
    expect(d!.paiementsEnAttente).toEqual([{ montant: 5000, devise: 'XOF', date: '2026-10-12T10:00:00Z' }]);
    expect(d!.paiementsReussis).toEqual([{ montant: 5000, devise: 'XOF', date: '2026-09-01T11:00:00Z' }]);
  });
});

describe('chronologie', () => {
  it('fusionne et trie les faits du plus récent au plus ancien', () => {
    const [d] = assemblerDossiers({
      ...vide,
      comptes: [{ id: 'u1', email: 'a@b.c', created_at: '2026-09-01T10:00:00Z', last_sign_in_at: null }],
      messages: [{ email: 'a@b.c', created_at: '2026-10-25T10:00:00Z' }],
      signaux: [{ user_id: 'u1', page: '/pricing', jour: '2026-10-29' }],
    });
    expect(chronologie(d!).map((e) => e.libelle)).toEqual(['A consulté /pricing', 'Message envoyé au support', 'Inscription']);
  });

  it('affiche la devise des paiements réussis et en attente', () => {
    const [d] = assemblerDossiers({
      ...vide,
      comptes: [{ id: 'u1', email: 'a@b.c', created_at: null, last_sign_in_at: null }],
      paiements: [
        { user_id: 'u1', amount: 20, currency: 'EUR', status: 'paid', created_at: '2026-09-01T10:00:00Z', paid_at: '2026-09-01T11:00:00Z' },
        { user_id: 'u1', amount: 5000, currency: 'XOF', status: 'pending', created_at: '2026-10-12T10:00:00Z', paid_at: null },
      ],
    });
    const lib = chronologie(d!).map((e) => e.libelle);
    expect(lib.find((l) => l.startsWith('Paiement réussi'))).toContain('EUR');
    expect(lib.find((l) => l.startsWith('Paiement commencé'))).toContain('FCFA');
  });
});
