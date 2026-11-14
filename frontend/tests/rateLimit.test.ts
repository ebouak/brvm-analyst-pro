import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

let rpcResult: { data: unknown; error: { code?: string; message: string } | null } = { data: true, error: null };
let legacyCount = 0;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: async () => rpcResult,
    from: () => {
      const chain: any = {
        delete: () => chain,
        select: () => chain,
        eq: () => chain,
        lt: async () => ({}),
        gte: async () => ({ count: legacyCount, error: null }),
        insert: async () => ({}),
      };
      return chain;
    },
  }),
}));

import { checkRateLimit } from '@/lib/server/rateLimit';

const opts = { route: 'r', ip: 'i', maxHits: 2, windowSeconds: 60 };

describe('checkRateLimit', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://x';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
    rpcResult = { data: true, error: null };
    legacyCount = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('suit le verdict de la fonction atomique', async () => {
    rpcResult = { data: false, error: null };
    expect((await checkRateLimit(opts)).allowed).toBe(false);
    rpcResult = { data: true, error: null };
    expect((await checkRateLimit(opts)).allowed).toBe(true);
  });

  it("retombe sur l'ancien chemin, avec journal, si la fonction est absente", async () => {
    rpcResult = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
    legacyCount = 5;
    expect((await checkRateLimit(opts)).allowed).toBe(false);
    legacyCount = 0;
    expect((await checkRateLimit(opts)).allowed).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('absente'));
  });

  it('autorise par défaut, refuse en failClosed, sur une erreur d’infrastructure', async () => {
    rpcResult = { data: null, error: { code: '57014', message: 'timeout' } };
    expect((await checkRateLimit(opts)).allowed).toBe(true);
    expect((await checkRateLimit({ ...opts, failClosed: true })).allowed).toBe(false);
  });

  it('refuse en failClosed quand la configuration manque', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect((await checkRateLimit(opts)).allowed).toBe(true);
    expect((await checkRateLimit({ ...opts, failClosed: true })).allowed).toBe(false);
  });
});
