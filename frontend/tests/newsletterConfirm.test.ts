import { describe, it, expect, vi } from 'vitest';

const update = vi.fn();
vi.mock('@/lib/billing/serviceClient', () => ({
  getServiceClient: () => ({
    from: () => ({
      update: (v: unknown) => {
        update(v);
        const chain: any = { eq: () => chain, select: async () => ({ data: [{ id: 1 }], error: null }) };
        return chain;
      },
    }),
  }),
}));

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/newsletter/confirm/route';

const T = '123e4567-e89b-12d3-a456-426614174000';

describe('confirmation newsletter', () => {
  it("GET affiche un bouton et n'écrit rien", async () => {
    const r = await GET(new NextRequest(`http://x/api/newsletter/confirm?token=${T}`));
    const html = await r.text();
    expect(html).toContain('method="POST"');
    expect(html).toContain(T);
    expect(update).not.toHaveBeenCalled();
  });
  it('POST confirme', async () => {
    const body = new URLSearchParams({ token: T });
    const r = await POST(new NextRequest('http://x/api/newsletter/confirm', { method: 'POST', body }));
    expect(await r.text()).toContain('Inscription confirmée');
    expect(update).toHaveBeenCalledTimes(1);
  });
  it('POST refuse un jeton invalide', async () => {
    const body = new URLSearchParams({ token: 'nope' });
    const r = await POST(new NextRequest('http://x/api/newsletter/confirm', { method: 'POST', body }));
    expect(await r.text()).toContain('invalide');
  });
});
