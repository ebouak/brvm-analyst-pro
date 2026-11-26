import { describe, it, expect } from 'vitest';
import { signerPulse, verifierPulse } from './pulseSignature';

const SECRET = 'un-secret-tres-long-pour-tests-hmac-32-caracteres-min';

describe('pulseSignature HMAC', () => {
  it('signe et vérifie un jeton valide dans la fenêtre', async () => {
    const now = 1_700_000_000;
    const { exp, sig } = await signerPulse(SECRET, now, 180);
    expect(await verifierPulse({ exp: String(exp), sig }, SECRET, now + 30)).toBe(true);
  });

  it('rejette un jeton expiré, falsifié ou un secret trop court', async () => {
    const now = 1_700_000_000;
    const { exp, sig } = await signerPulse(SECRET, now, 60);
    expect(await verifierPulse({ exp: String(exp), sig }, SECRET, now + 61)).toBe(false);
    expect(await verifierPulse({ exp: String(exp + 1), sig }, SECRET, now)).toBe(false);
    expect(await verifierPulse({ exp: String(exp), sig }, 'trop-court', now)).toBe(false);
  });
});
