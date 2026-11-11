import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

let flag: Record<string, unknown> | null = null;
let rpcResult: { data: unknown; error: { message: string } | null } = { data: 1, error: null };

vi.mock('@/lib/billing/serviceClient', () => ({
  getServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: flag }) }) }),
    }),
    rpc: async () => rpcResult,
  }),
}));

import { checkFeature } from './featureGate';

const user = { id: 'u1', email: 'someone@example.com', isPremium: false };
const base = { code: 'x', label: 'X', acces: 'free', quota_free: 3, quota_premium: null, description: null };

describe('checkFeature', () => {
  beforeEach(() => {
    flag = { ...base };
    rpcResult = { data: 1, error: null };
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('refuse une fonctionnalité non déclarée', async () => {
    flag = null;
    const r = await checkFeature('assistant_ia', user);
    expect(r).toMatchObject({ allowed: false, status: 403 });
  });

  it('autorise sous le quota', async () => {
    const r = await checkFeature('assistant_ia', user);
    expect(r).toMatchObject({ allowed: true, used: 1, quota: 3 });
  });

  it('refuse (429) quand le décompte échoue sur un quota borné', async () => {
    rpcResult = { data: null, error: { message: 'boom' } };
    const r = await checkFeature('assistant_ia', user);
    expect(r).toMatchObject({ allowed: false, status: 429 });
  });

  it('laisse passer quand le décompte échoue sur une branche illimitée', async () => {
    flag = { ...base, quota_free: null };
    rpcResult = { data: null, error: { message: 'boom' } };
    const r = await checkFeature('assistant_ia', user);
    expect(r).toMatchObject({ allowed: true, quota: null });
  });

  it("reconnaît l'admin sans tenir compte de la casse", async () => {
    flag = null;
    const r = await checkFeature('assistant_ia', { ...user, email: 'EBOUAK@Gmail.com' });
    expect(r.allowed).toBe(true);
  });
});
