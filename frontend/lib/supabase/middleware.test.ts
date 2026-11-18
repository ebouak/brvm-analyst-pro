import { describe, expect, it } from 'vitest';
import { porteCookieSession } from './middleware';

describe('porteCookieSession (chemin court du middleware)', () => {
  it('aucun cookie : pas de session', () => {
    expect(porteCookieSession([])).toBe(false);
  });
  it('cookies sans rapport (consentement, PostHog) : pas de session', () => {
    expect(porteCookieSession(['ws_consent', 'ph_phc_abc_posthog', 'sb_tracking'])).toBe(false);
  });
  it('jeton Supabase entier', () => {
    expect(porteCookieSession(['sb-abcdefgh-auth-token'])).toBe(true);
  });
  it('jeton Supabase découpé en morceaux', () => {
    expect(porteCookieSession(['x', 'sb-abcdefgh-auth-token.0', 'sb-abcdefgh-auth-token.1'])).toBe(true);
  });
  it('vérificateur PKCE seul (connexion en cours) : session à traiter', () => {
    expect(porteCookieSession(['sb-abcdefgh-auth-token-code-verifier'])).toBe(true);
  });
});
