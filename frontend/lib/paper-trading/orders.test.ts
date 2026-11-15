import { describe, expect, it } from 'vitest';
import {
  evaluatePaperOrder,
  validatePlacePaperOrder,
  type PaperBookSnapshot,
  type PaperMarketSession,
  type PaperOrderForEvaluation,
} from './orders';

const order = (
  overrides: Partial<PaperOrderForEvaluation> = {},
): PaperOrderForEvaluation => ({
  id: 'order-1',
  side: 'buy',
  type: 'at_best',
  mode: 'fixing',
  limitPrice: null,
  quantity: 10,
  filledQuantity: 0,
  expiresAfterSessions: 5,
  evaluatedSessions: 0,
  submittedAfter: '2026-11-12',
  createdAt: '2026-11-12T20:00:00Z',
  reservedCashRemaining: 2_000,
  reservedSharesRemaining: 0,
  ...overrides,
});

const session = (
  overrides: Partial<PaperMarketSession> = {},
): PaperMarketSession => ({
  date: '2026-11-13',
  close: 100,
  volume: 100,
  ...overrides,
});

const book = (
  overrides: Partial<PaperBookSnapshot> = {},
): PaperBookSnapshot => ({
  date: '2026-11-12',
  collectedAt: '2026-11-12T19:00:00Z',
  buyQuantity: 20,
  buyPrice: 99,
  sellQuantity: 20,
  sellPrice: 101,
  buyAtMarket: false,
  sellAtMarket: false,
  ...overrides,
});

describe('evaluatePaperOrder', () => {
  it('does not evaluate a session on or before submission', () => {
    const result = evaluatePaperOrder(
      order({ submittedAfter: '2026-11-12' }),
      session({ date: '2026-11-12', close: 100, volume: 1_000 }),
      null,
    );

    expect(result).toMatchObject({ status: 'waiting_data', fillQuantity: 0 });
  });

  it('executes an au-mieux order at a future fixing', () => {
    expect(evaluatePaperOrder(order(), session({ close: 99 }), null)).toMatchObject({
      status: 'filled',
      fillQuantity: 10,
      fillPrice: 99,
      evaluatedDate: '2026-11-13',
    });
  });

  it('fills a buy limit only when the future fixing is at or below the limit', () => {
    expect(
      evaluatePaperOrder(
        order({ type: 'limit', limitPrice: 100 }),
        session({ close: 99 }),
        null,
      ).fillQuantity,
    ).toBe(10);
    expect(
      evaluatePaperOrder(
        order({ type: 'limit', limitPrice: 98 }),
        session({ close: 99 }),
        null,
      ).fillQuantity,
    ).toBe(0);
  });

  it('uses the reverse price condition for a sell limit', () => {
    const sellOrder = order({
      side: 'sell',
      type: 'limit',
      limitPrice: 101,
      reservedCashRemaining: 0,
      reservedSharesRemaining: 10,
    });

    expect(evaluatePaperOrder(sellOrder, session({ close: 102 }), null).fillQuantity).toBe(10);
    expect(evaluatePaperOrder(sellOrder, session({ close: 100 }), null).fillQuantity).toBe(0);
  });

  it('caps a prudent buy by remaining quantity, prior BOC sell residual, volume and cash', () => {
    const result = evaluatePaperOrder(
      order({
        mode: 'boc_prudent',
        quantity: 50,
        filledQuantity: 5,
        submittedAfter: '2026-11-13',
        createdAt: '2026-11-13T21:00:00Z',
        reservedCashRemaining: 1_980,
      }),
      session({ date: '2026-11-14', close: 99, volume: 20 }),
      book({
        date: '2026-11-13',
        collectedAt: '2026-11-13T20:00:00Z',
        sellQuantity: 12,
      }),
    );

    expect(result).toMatchObject({
      status: 'partial',
      fillQuantity: 12,
      fillPrice: 99,
      bookDate: '2026-11-13',
    });
  });

  it('caps a prudent sell by the prior BOC buy residual and reserved shares', () => {
    const result = evaluatePaperOrder(
      order({
        side: 'sell',
        mode: 'boc_prudent',
        quantity: 20,
        reservedCashRemaining: 0,
        reservedSharesRemaining: 10,
      }),
      session({ volume: 100 }),
      book({ buyQuantity: 8 }),
    );

    expect(result).toMatchObject({ status: 'partial', fillQuantity: 8 });
  });

  it('does not use a BOC collected after order creation', () => {
    const result = evaluatePaperOrder(
      order({ mode: 'boc_prudent' }),
      session(),
      book({ collectedAt: '2026-11-13T20:00:00Z' }),
    );

    expect(result).toMatchObject({ status: 'waiting_data', fillQuantity: 0 });
  });

  it('accepts a BOC collected before order creation on the submission session', () => {
    const result = evaluatePaperOrder(
      order({
        mode: 'boc_prudent',
        submittedAfter: '2026-11-12',
        createdAt: '2026-11-12T20:00:00Z',
      }),
      session({ date: '2026-11-13' }),
      book({ date: '2026-11-12', collectedAt: '2026-11-12T19:59:00Z' }),
    );

    expect(result).toMatchObject({ status: 'filled', fillQuantity: 10 });
  });

  const missingDataCases: Array<{
    label: string;
    marketSession: PaperMarketSession;
    priorBook: PaperBookSnapshot | null;
  }> = [
    { label: 'missing quote', marketSession: session({ close: null }), priorBook: null },
    { label: 'invalid quote', marketSession: session({ close: 0 }), priorBook: null },
    { label: 'missing volume', marketSession: session({ volume: null }), priorBook: null },
  ];

  it.each(missingDataCases)('waits for $label', ({ marketSession, priorBook }) => {
    expect(evaluatePaperOrder(order(), marketSession, priorBook)).toMatchObject({
      status: 'waiting_data',
      fillQuantity: 0,
    });
  });

  it('waits for a missing BOC and does not fill against a zero opposing quantity', () => {
    expect(
      evaluatePaperOrder(order({ mode: 'boc_prudent' }), session(), null).status,
    ).toBe('waiting_data');
    expect(
      evaluatePaperOrder(
        order({ mode: 'boc_prudent' }),
        session(),
        book({ sellQuantity: 0 }),
      ),
    ).toMatchObject({ status: 'pending', fillQuantity: 0 });
  });

  it('does not fill when the fixing session has zero traded volume', () => {
    expect(
      evaluatePaperOrder(order(), session({ volume: 0 }), null),
    ).toMatchObject({ status: 'pending', fillQuantity: 0 });
  });

  it.each([
    ['future', '2026-11-15', '2026-11-12', '2026-11-14'],
    ['same as evaluation', '2026-11-14', '2026-11-12', '2026-11-14'],
    ['after submission', '2026-11-14', '2026-11-13', '2026-11-15'],
  ])('waits for a BOC date that is %s', (_label, bookDate, submittedAfter, sessionDate) => {
    expect(
      evaluatePaperOrder(
        order({ mode: 'boc_prudent', submittedAfter }),
        session({ date: sessionDate }),
        book({ date: bookDate }),
      ),
    ).toMatchObject({ status: 'waiting_data', fillQuantity: 0 });
  });

  it('keeps an unfilled valid limit pending and counts the evaluated session', () => {
    expect(
      evaluatePaperOrder(
        order({ type: 'limit', limitPrice: 90, expiresAfterSessions: 2 }),
        session({ close: 100 }),
        null,
      ),
    ).toMatchObject({ status: 'pending', fillQuantity: 0, evaluatedSessions: 1 });
  });

  it('expires the unfilled remainder on the last eligible session', () => {
    expect(
      evaluatePaperOrder(
        order({ type: 'limit', limitPrice: 90, expiresAfterSessions: 2, evaluatedSessions: 1 }),
        session({ close: 100 }),
        null,
      ),
    ).toMatchObject({ status: 'expired', fillQuantity: 0, evaluatedSessions: 2 });
  });

  it('preserves partial-fill accounting when evaluating the remaining quantity', () => {
    expect(
      evaluatePaperOrder(
        order({
          quantity: 15,
          filledQuantity: 5,
          mode: 'boc_prudent',
          createdAt: '2026-11-12T20:00:00Z',
        }),
        session({ volume: 5 }),
        book(),
      ),
    ).toMatchObject({ status: 'partial', fillQuantity: 5 });
  });

  it('expires the unfilled remainder after a partial fill on the final session', () => {
    expect(
      evaluatePaperOrder(
        order({
          mode: 'boc_prudent',
          quantity: 20,
          expiresAfterSessions: 1,
        }),
        session({ volume: 5 }),
        book(),
      ),
    ).toMatchObject({
      status: 'expired',
      fillQuantity: 5,
      reason: 'validity_expired',
    });
  });

  it('caps an au-mieux buy at the shares affordable from its cash reservation', () => {
    expect(
      evaluatePaperOrder(order({ reservedCashRemaining: 499 }), session({ close: 100 }), null),
    ).toMatchObject({ status: 'cancelled', fillQuantity: 4, fillPrice: 100 });
  });

  it('does not consume an expiry session when required data is missing', () => {
    expect(
      evaluatePaperOrder(
        order({ mode: 'boc_prudent', evaluatedSessions: 2, expiresAfterSessions: 3 }),
        session(),
        null,
      ),
    ).toMatchObject({ status: 'waiting_data', evaluatedSessions: 2 });
  });
});

describe('validatePlacePaperOrder', () => {
  const validOrder = {
    code: 'BOAC',
    side: 'buy',
    type: 'limit',
    mode: 'boc_prudent',
    quantity: 10,
    limitPrice: 100,
    expiresAfterSessions: 5,
  };

  it('accepts a valid limit order', () => {
    expect(validatePlacePaperOrder(validOrder)).toEqual(validOrder);
  });

  it.each([
    null,
    [],
    'order',
    { ...validOrder, ownerId: 'someone-else' },
    { ...validOrder, code: 'AB' },
    { ...validOrder, side: 'hold' },
    { ...validOrder, type: 'market' },
    { ...validOrder, mode: 'live' },
    { ...validOrder, quantity: 0 },
    { ...validOrder, quantity: 1.5 },
    { ...validOrder, quantity: Number.NaN },
    { ...validOrder, limitPrice: 0 },
    { ...validOrder, expiresAfterSessions: 0 },
    { ...validOrder, expiresAfterSessions: 21 },
    { ...validOrder, type: 'at_best', limitPrice: 100 },
    { ...validOrder, type: 'limit', limitPrice: null },
  ])('rejects invalid input %j', (input) => {
    expect(validatePlacePaperOrder(input)).toBeNull();
  });

  it('accepts au-mieux only without a limit price', () => {
    expect(
      validatePlacePaperOrder({
        ...validOrder,
        type: 'at_best',
        limitPrice: null,
      }),
    ).toMatchObject({ type: 'at_best', limitPrice: null });
  });
});
