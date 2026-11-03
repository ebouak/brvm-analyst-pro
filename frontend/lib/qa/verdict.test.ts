import { describe, it, expect } from 'vitest';
import { verdictRun, resultatsAnciens, compareVersions, DELAI_INCOMPLET_MS, type RunResume } from './verdict';

const maintenant = new Date('2026-11-03T12:00:00Z');
const base: RunResume = {
  statut: 'termine',
  debut_at: '2026-11-03T03:00:00Z',
  fin_at: '2026-11-03T03:10:00Z',
  nb_reussis: 5,
  nb_echoues: 0,
  nb_intermittents: 0,
  nb_ignores: 0,
};

describe('verdictRun', () => {
  it('succès quand tout est passé', () => {
    expect(verdictRun(base, maintenant)).toBe('succes');
  });

  it('échec dès qu’un scénario échoue', () => {
    expect(verdictRun({ ...base, nb_echoues: 1 }, maintenant)).toBe('echec');
  });

  it('succès avec intermittents distingué du succès', () => {
    expect(verdictRun({ ...base, nb_intermittents: 2 }, maintenant)).toBe('intermittent');
  });

  it('jamais un succès si aucun test n’a été exécuté', () => {
    expect(verdictRun({ ...base, nb_reussis: 0, nb_ignores: 4 }, maintenant)).toBe('aucun_test');
    expect(verdictRun({ ...base, nb_reussis: 0 }, maintenant)).toBe('aucun_test');
  });

  it('une erreur d’infrastructure n’est jamais un succès, même avec des tests passés', () => {
    expect(verdictRun({ ...base, statut: 'erreur_infra' }, maintenant)).toBe('erreur_infra');
  });

  it('interrompu reste interrompu', () => {
    expect(verdictRun({ ...base, statut: 'interrompu' }, maintenant)).toBe('interrompu');
  });

  it('en cours tant que le délai n’est pas dépassé', () => {
    const debut = new Date(maintenant.getTime() - 10 * 60_000).toISOString();
    expect(verdictRun({ ...base, statut: 'en_cours', debut_at: debut, fin_at: null }, maintenant)).toBe('en_cours');
  });

  it('incomplet quand le runner ne s’est jamais manifesté', () => {
    const debut = new Date(maintenant.getTime() - DELAI_INCOMPLET_MS - 1).toISOString();
    expect(verdictRun({ ...base, statut: 'en_cours', debut_at: debut, fin_at: null }, maintenant)).toBe('incomplet');
  });
});

describe('resultatsAnciens', () => {
  it('ancien au-delà de 7 jours', () => {
    expect(resultatsAnciens('2026-10-26T11:59:00Z', maintenant)).toBe(true);
    expect(resultatsAnciens('2026-10-28T12:00:00Z', maintenant)).toBe(false);
  });
});

describe('compareVersions', () => {
  const a = 'a'.repeat(40);
  const b = 'b'.repeat(40);
  it('identique', () => expect(compareVersions(a, a)).toBe('identique'));
  it('différente', () => expect(compareVersions(a, b)).toBe('differente'));
  it('déployée inconnue', () => expect(compareVersions(a, undefined)).toBe('inconnue'));
  it('compare sans tenir compte de la casse', () => expect(compareVersions(a, a.toUpperCase())).toBe('identique'));
});
