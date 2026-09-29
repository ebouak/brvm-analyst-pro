import { describe, expect, it } from 'vitest';
import { aRappeler, composerRappel, type PassActif } from '../src/pass/rappels.js';

const now = new Date('2026-10-01T06:00:00Z');
const pass = (renews_at: string | null, rappel: string | null = null): PassActif => ({
  id: `s-${renews_at}`,
  user_id: 'u1',
  renews_at,
  rappel_expiration_at: rappel,
  plan: 'Premium',
});

describe('aRappeler', () => {
  it('retient un pass qui finit dans 7 jours ou moins', () => {
    expect(aRappeler([pass('2026-10-08T06:00:00Z'), pass('2026-10-02T00:00:00Z')], now)).toHaveLength(2);
  });

  it('écarte un pass qui finit dans plus de 7 jours', () => {
    expect(aRappeler([pass('2026-10-09T00:00:00Z')], now)).toHaveLength(0);
  });

  it('écarte un pass déjà échu (l’expiration s’en charge, pas un rappel)', () => {
    expect(aRappeler([pass('2026-09-30T00:00:00Z')], now)).toHaveLength(0);
  });

  it('IDEMPOTENCE : écarte un pass déjà rappelé', () => {
    expect(aRappeler([pass('2026-10-05T00:00:00Z', '2026-09-28T06:00:00Z')], now)).toHaveLength(0);
  });

  it('écarte un pass sans échéance ou à l’échéance illisible', () => {
    expect(aRappeler([pass(null), pass('pas une date')], now)).toHaveLength(0);
  });
});

describe('composerRappel', () => {
  const m = composerRappel({ plan: 'Premium', echeance: '2026-10-08T06:00:00Z', lien: 'https://www.westbourse.com/account/plan' });

  it('annonce la date et l’absence de prélèvement', () => {
    expect(m.sujet).toContain('8 octobre 2026');
    expect(m.texte).toContain('aucun prélèvement');
    expect(m.html).toContain('href="https://www.westbourse.com/account/plan"');
  });

  it('ne contient AUCUN montant (le prix vit sur la page de paiement)', () => {
    expect(`${m.texte} ${m.html}`).not.toMatch(/FCFA|XOF|€|\bprix\b/i);
  });

  it('échappe le nom du plan dans le HTML', () => {
    const x = composerRappel({ plan: '<script>', echeance: '2026-10-08T06:00:00Z', lien: 'https://x' });
    expect(x.html).not.toContain('<script>');
  });
});
