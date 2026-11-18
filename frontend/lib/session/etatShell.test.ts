import { describe, expect, it } from 'vitest';
import { ETAT_INCONNU, etatShell } from './etatShell';

describe('etatShell (règle reprise de l’ancien layout racine)', () => {
  it('avant lecture : état inconnu, sans premium ni onboarding', () => {
    expect(ETAT_INCONNU.connecte).toBeUndefined();
    expect(ETAT_INCONNU.isPremium).toBe(false);
    expect(ETAT_INCONNU.onboardingDone).toBe(true);
  });

  it('anonyme : déconnecté, onboarding considéré fait', () => {
    expect(etatShell(null, false, null)).toEqual({
      connecte: false, isAdmin: false, isPremium: false, onboardingDone: true, modeDebutant: false,
    });
  });

  it('connecté sans profil lu : pas premium, onboarding à faire', () => {
    const e = etatShell('a@b.c', true, null);
    expect(e).toMatchObject({ connecte: true, isAdmin: false, isPremium: false, onboardingDone: false, modeDebutant: false });
  });

  it('connecté premium, mode débutant', () => {
    const e = etatShell('a@b.c', true, { is_premium: true, onboarding_done: true, mode_debutant: true });
    expect(e).toMatchObject({ isPremium: true, onboardingDone: true, modeDebutant: true });
  });

  it('super admin : premium et onboarding sauté par défaut', () => {
    const e = etatShell('ebouak@gmail.com', true, null);
    expect(e).toMatchObject({ isAdmin: true, isPremium: true, onboardingDone: true });
  });

  it('super admin : un onboarding_done explicite l’emporte', () => {
    const e = etatShell('ebouak@gmail.com', true, { is_premium: false, onboarding_done: false, mode_debutant: null });
    expect(e).toMatchObject({ isPremium: true, onboardingDone: false });
  });
});
