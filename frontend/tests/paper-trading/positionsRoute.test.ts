import { afterEach, describe, expect, it, vi } from 'vitest';

const { createClientMock, settlePaperOrdersMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  settlePaperOrdersMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));
vi.mock('@/lib/paper-trading/ordersServer', () => ({
  settlePaperOrders: settlePaperOrdersMock,
}));

import { NextRequest } from 'next/server';
import { GET } from '../../app/api/paper-trading/positions/route';

function query(
  rows: unknown[],
  single: unknown = null,
  onRange?: (from: number, to: number) => void,
) {
  let start = 0;
  let end = 999;
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    range: (from: number, to: number) => {
      start = from;
      end = to;
      onRange?.(from, to);
      return builder;
    },
    maybeSingle: async () => ({ data: single, error: null }),
    then: (
      onfulfilled?: (value: { data: unknown[]; error: null }) => unknown,
      onrejected?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: rows.slice(start, end + 1), error: null })
      .then(onfulfilled, onrejected),
  };
  return builder;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/paper-trading/positions', () => {
  it('includes reservations beyond the PostgREST page limit', async () => {
    const orders = Array.from({ length: 1_001 }, () => ({
      code: 'ABJC',
      side: 'buy',
      reserved_cash_remaining: 1,
      reserved_shares_remaining: 0,
    }));
    const orderRanges: Array<[number, number]> = [];
    createClientMock.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: (table: string) => {
        if (table === 'paper_trading_accounts') {
          return query([], { id: 'account-1', capital_current: 10_000 });
        }
        if (table === 'paper_trading_positions') {
          return query([]);
        }
        return query(orders, null, (from, to) => orderRanges.push([from, to]));
      },
    });

    const response = await GET(new NextRequest('http://localhost/api/paper-trading/positions'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.cashReserved).toBe(1_001);
    expect(body.cashAvailable).toBe(8_999);
    expect(orderRanges).toEqual([[0, 999], [1_000, 1_999]]);
  });
});
