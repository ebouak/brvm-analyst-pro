import { describe, it, expect } from 'vitest';
import { aEnvoyer, MAX_TENTATIVES, type Compte, type Abonnement } from '../src/bienvenue/selection.js';
import { composer } from '../src/bienvenue/message.js';

const DEPUIS = '2026-09-29T00:00:00Z';
const compte = (id: string, created_at = '2026-09-30T08:00:00Z', email: string | null = `${id}@exemple.ci`): Compte =>
  ({ id, email, created_at });
const abo = (user_id: string, o: Partial<Abonnement> = {}): Abonnement =>
  ({ user_id, status: 'active', started_at: '2026-10-01T10:00:00Z', payant: true, ...o });

describe('aEnvoyer — qui reçoit quoi', () => {
  it('un nouveau compte reçoit l’email d’inscription', () => {
    const r = aEnvoyer({ comptes: [compte('u1')], abonnements: [], journal: [], depuis: DEPUIS });
    expect(r).toEqual([{ user_id: 'u1', email: 'u1@exemple.ci', motif: 'inscription', tentatives: 0 }]);
  });

  it('JAMAIS RÉTROACTIF : un compte créé avant la mise en service ne reçoit rien', () => {
    const r = aEnvoyer({ comptes: [compte('ancien', '2026-09-20T08:00:00Z')], abonnements: [], journal: [], depuis: DEPUIS });
    expect(r).toEqual([]);
  });

  it('déjà envoyé → sauté : relancer le job ne réécrit à personne', () => {
    const r = aEnvoyer({
      comptes: [compte('u1')], abonnements: [],
      journal: [{ user_id: 'u1', motif: 'inscription', statut: 'envoye', tentatives: 1 }], depuis: DEPUIS,
    });
    expect(r).toEqual([]);
  });

  it('un échec est retenté, avec le compteur de tentatives, jusqu’au plafond', () => {
    const j = (t: number) => [{ user_id: 'u1', motif: 'inscription' as const, statut: 'echec' as const, tentatives: t }];
    expect(aEnvoyer({ comptes: [compte('u1')], abonnements: [], journal: j(1), depuis: DEPUIS })[0].tentatives).toBe(1);
    expect(aEnvoyer({ comptes: [compte('u1')], abonnements: [], journal: j(MAX_TENTATIVES), depuis: DEPUIS })).toEqual([]);
  });

  it('adresse absente ou invalide → rien (on ne devine pas de destinataire)', () => {
    const r = aEnvoyer({ comptes: [compte('u1', undefined, null), compte('u2', undefined, 'pas-une-adresse')], abonnements: [], journal: [], depuis: DEPUIS });
    expect(r).toEqual([]);
  });

  it('un abonnement PAYANT actif démarré après la mise en service reçoit l’email d’abonnement', () => {
    const ancien = compte('u9', '2026-01-01T00:00:00Z');
    const r = aEnvoyer({ comptes: [ancien], abonnements: [abo('u9')], journal: [], depuis: DEPUIS });
    expect(r).toEqual([{ user_id: 'u9', email: 'u9@exemple.ci', motif: 'abonnement', tentatives: 0 }]);
  });

  it('le plan gratuit, un abonnement inactif ou démarré avant la mise en service ne déclenchent rien', () => {
    const c = compte('u9', '2026-01-01T00:00:00Z');
    for (const a of [abo('u9', { payant: false }), abo('u9', { status: 'canceled' }), abo('u9', { started_at: '2026-09-01T00:00:00Z' }), abo('u9', { started_at: null })]) {
      expect(aEnvoyer({ comptes: [c], abonnements: [a], journal: [], depuis: DEPUIS })).toEqual([]);
    }
  });

  it('deux abonnements actifs du même compte → un seul email', () => {
    const r = aEnvoyer({ comptes: [compte('u9', '2026-01-01T00:00:00Z')], abonnements: [abo('u9'), abo('u9')], journal: [], depuis: DEPUIS });
    expect(r).toHaveLength(1);
  });
});

describe('composer — ce qui est écrit', () => {
  const liens = { lecon: 'https://www.westbourse.com/formations/academy/lecon-0', affiche: 'https://x.supabase.co/a.jpg', sgi: 'https://www.westbourse.com/comparateur-sgi' };

  it('les deux motifs pointent vers la leçon 0, en HTML comme en texte', () => {
    for (const motif of ['inscription', 'abonnement'] as const) {
      const m = composer(motif, liens);
      expect(m.texte).toContain(liens.lecon);
      expect(m.html).toContain(`href="${liens.lecon}"`);
      expect(m.html).toContain(`src="${liens.affiche}"`);
      expect(m.texte).toContain('pas un conseil en investissement');
    }
  });

  it('aucun chiffre de marché dans le corps ni le sujet', () => {
    const m = composer('inscription', { ...liens, lecon: 'https://w.example/lecon', sgi: 'https://w.example/sgi' });
    // « leçon 0 » est le NOM de la leçon, pas un chiffre : seule exception tolérée.
    const sansLecon = (t: string) => t.replace(/leçon 0/gi, 'leçon');
    expect(sansLecon(m.texte)).not.toMatch(/\d/);
    expect(sansLecon(m.sujet)).not.toMatch(/\d/);
  });

  it('les sujets distinguent inscription et abonnement', () => {
    expect(composer('inscription', liens).sujet).not.toBe(composer('abonnement', liens).sujet);
  });
});
