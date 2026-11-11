import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

const updates: Array<Record<string, unknown>> = [];
let lockRows: Array<{ id: string }> = [{ id: 't1' }];
const activate = vi.fn(async () => ({ ok: true }));

vi.mock('@/lib/billing/activate', () => ({ activateSubscription: (...a: unknown[]) => activate(...(a as [])) }));
vi.mock('@/lib/billing/cinetPayProvider', () => ({ cinetPayConfig: () => ({ apiKey: 'k', siteId: 's' }) }));
vi.mock('@/lib/billing/serviceClient', () => ({
  getServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: 't1', subscription_id: 's1', user_id: 'u1', amount: 10000, currency: 'XOF', status: 'pending' },
          }),
        }),
      }),
      update: (v: Record<string, unknown>) => {
        updates.push(v);
        const chain: any = {
          eq: () => chain,
          in: () => chain,
          select: async () => ({ data: v.status === 'processing' ? lockRows : [], error: null }),
          then: (res: (x: unknown) => void) => res({ error: null }),
        };
        return chain;
      },
    }),
  }),
}));

import { POST } from '@/app/api/billing/webhook/cinetpay/route';

const SECRET = 'secret-de-test';
function req() {
  const raw = 'cpm_trans_id=t1';
  const token = createHmac('sha256', SECRET).update(raw).digest('hex');
  return new Request('http://x/api/billing/webhook/cinetpay', { method: 'POST', body: raw, headers: { 'x-token': token } });
}
function checkReturns(data: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ data }) })));
}

describe('webhook CinetPay', () => {
  beforeEach(() => {
    updates.length = 0;
    lockRows = [{ id: 't1' }];
    activate.mockClear();
    process.env.CINETPAY_SECRET_KEY = SECRET;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('refuse une réponse sans devise', async () => {
    checkReturns({ status: 'ACCEPTED', amount: 10000 });
    const r = await POST(req());
    expect((await r.json()).motif).toBe('devise inattendue');
    expect(activate).not.toHaveBeenCalled();
  });

  it('active une fois avec la bonne devise', async () => {
    checkReturns({ status: 'ACCEPTED', amount: 10000, currency: 'XOF' });
    await POST(req());
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it("n'active pas quand le verrou est déjà pris par une autre notification", async () => {
    lockRows = [];
    checkReturns({ status: 'ACCEPTED', amount: 10000, currency: 'XOF' });
    const r = await POST(req());
    expect((await r.json()).deja_en_cours).toBe(true);
    expect(activate).not.toHaveBeenCalled();
  });
});
