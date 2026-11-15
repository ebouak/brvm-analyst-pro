import { afterEach, describe, expect, it, vi } from 'vitest';

const { getServiceClientMock } = vi.hoisted(() => ({
  getServiceClientMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/billing/serviceClient', () => ({
  getServiceClient: getServiceClientMock,
}));

import { listPaperOrders, settlePaperOrders } from './ordersServer';

function query(
  readRows: () => unknown[],
  readSingle: () => unknown,
) {
  let start = 0;
  let end = 999;
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    gt: () => builder,
    order: () => builder,
    range: (from: number, to: number) => {
      start = from;
      end = to;
      return builder;
    },
    maybeSingle: async () => ({ data: readSingle(), error: null }),
    then: (
      onfulfilled?: (value: { data: unknown[]; error: null }) => unknown,
      onrejected?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: readRows().slice(start, end + 1), error: null })
      .then(onfulfilled, onrejected),
  };
  return builder;
}

const pendingOrder = {
  id: 'order-1',
  user_id: 'user-1',
  account_id: 'account-1',
  code: 'ABJC',
  side: 'buy',
  order_type: 'at_best',
  execution_mode: 'fixing',
  status: 'pending',
  limit_price: null,
  quantity: 10,
  filled_quantity: 0,
  expires_after_sessions: 1,
  evaluated_sessions: 0,
  submitted_after: '2026-11-12',
  created_at: '2026-11-12T20:00:00Z',
  updated_at: '2026-11-12T20:00:00Z',
  last_evaluated_date: null,
  reserved_cash_remaining: 1_000,
  reserved_shares_remaining: 0,
  waiting_reason: null,
  boc_date: null,
  boc_collected_at: null,
  boc_buy_quantity: null,
  boc_buy_price: null,
  boc_sell_quantity: null,
  boc_sell_price: null,
  boc_buy_at_market: false,
  boc_sell_at_market: false,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('settlePaperOrders', () => {
  it('treats a concurrent duplicate session evaluation as an idempotent result', async () => {
    let actionQueries = 0;
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, already_evaluated: true, fill: null },
      error: null,
    });
    getServiceClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === 'paper_trading_orders') {
          return query(() => [pendingOrder], () => null);
        }

        actionQueries += 1;
        if (actionQueries === 1) {
          return query(
            () => [{ date_marche: '2026-11-13', code: 'ABJC' }],
            () => null,
          );
        }
        return query(
          () => [],
          () => ({ cours_jour: 100, volume: 100 }),
        );
      },
      rpc,
    });

    await expect(settlePaperOrders('user-1')).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe('listPaperOrders', () => {
  it('returns order and fill history beyond the PostgREST page limit', async () => {
    const orders = Array.from({ length: 1_001 }, (_, index) => ({
      ...pendingOrder,
      id: `order-${index}`,
      status: 'filled',
      quantity: 1,
      filled_quantity: 1,
      reserved_cash_remaining: 0,
    }));
    const fills = Array.from({ length: 1_001 }, (_, index) => ({
      id: `fill-${index}`,
      order_id: `order-${index}`,
      code: 'ABJC',
      date_marche: '2026-11-13',
      quantity: 1,
      price: 100,
      execution_mode: 'fixing',
      boc_date: null,
      created_at: '2026-11-13T20:00:00Z',
    }));
    getServiceClientMock.mockReturnValue({
      from: (table: string) => query(
        () => table === 'paper_trading_orders' ? orders : fills,
        () => null,
      ),
    });

    const result = await listPaperOrders('user-1');

    expect(result.orders).toHaveLength(1_001);
    expect(result.fills).toHaveLength(1_001);
  });
});
