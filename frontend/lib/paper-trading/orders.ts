export type PaperOrderSide = 'buy' | 'sell';
export type PaperOrderType = 'at_best' | 'limit';
export type PaperExecutionMode = 'fixing' | 'boc_prudent';
export type PaperOrderStatus =
  | 'pending'
  | 'partial'
  | 'filled'
  | 'expired'
  | 'cancelled'
  | 'waiting_data';

export interface PaperOrderForEvaluation {
  id: string;
  side: PaperOrderSide;
  type: PaperOrderType;
  mode: PaperExecutionMode;
  limitPrice: number | null;
  quantity: number;
  filledQuantity: number;
  expiresAfterSessions: number;
  evaluatedSessions: number;
  submittedAfter: string;
  createdAt: string;
  reservedCashRemaining: number;
  reservedSharesRemaining: number;
}

export interface PaperMarketSession {
  date: string;
  close: number | null;
  volume: number | null;
}

export interface PaperBookSnapshot {
  date: string;
  buyQuantity: number | null;
  buyPrice: number | null;
  sellQuantity: number | null;
  sellPrice: number | null;
  buyAtMarket: boolean;
  sellAtMarket: boolean;
  collectedAt: string;
}

export interface PaperOrderEvaluation {
  status: PaperOrderStatus;
  fillQuantity: number;
  fillPrice: number | null;
  evaluatedSessions: number;
  reason: string;
  evaluatedDate: string | null;
  bookDate: string | null;
}

export interface PlacePaperOrderInput {
  code: string;
  side: PaperOrderSide;
  type: PaperOrderType;
  mode: PaperExecutionMode;
  quantity: number;
  limitPrice: number | null;
  expiresAfterSessions: number;
}

const PLACE_ORDER_FIELDS = new Set([
  'code',
  'side',
  'type',
  'mode',
  'quantity',
  'limitPrice',
  'expiresAfterSessions',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function validatePlacePaperOrder(input: unknown): PlacePaperOrderInput | null {
  if (!isRecord(input)) return null;
  if (Object.keys(input).some((key) => !PLACE_ORDER_FIELDS.has(key))) return null;

  if (typeof input.code !== 'string' || !/^[A-Z]{3,5}$/.test(input.code)) return null;
  if (input.side !== 'buy' && input.side !== 'sell') return null;
  if (input.type !== 'at_best' && input.type !== 'limit') return null;
  if (input.mode !== 'fixing' && input.mode !== 'boc_prudent') return null;
  if (!isSafeInteger(input.quantity) || input.quantity <= 0) return null;
  if (!isSafeInteger(input.expiresAfterSessions)) return null;
  if (input.expiresAfterSessions < 1 || input.expiresAfterSessions > 20) return null;

  if (input.type === 'limit') {
    if (!isPositiveFiniteNumber(input.limitPrice)) return null;
  } else if (input.limitPrice !== null) {
    return null;
  }

  return {
    code: input.code,
    side: input.side,
    type: input.type,
    mode: input.mode,
    quantity: input.quantity,
    limitPrice: input.limitPrice,
    expiresAfterSessions: input.expiresAfterSessions,
  };
}

function waitingForData(
  order: PaperOrderForEvaluation,
  reason: string,
  evaluatedDate: string | null,
): PaperOrderEvaluation {
  return {
    status: 'waiting_data',
    fillQuantity: 0,
    fillPrice: null,
    evaluatedSessions: order.evaluatedSessions,
    reason,
    evaluatedDate,
    bookDate: null,
  };
}

function eligibleBook(
  order: PaperOrderForEvaluation,
  session: PaperMarketSession,
  priorBook: PaperBookSnapshot | null,
): PaperBookSnapshot | null {
  if (
    !priorBook ||
    !isDateKey(priorBook.date) ||
    !isTimestamp(priorBook.collectedAt) ||
    !isTimestamp(order.createdAt) ||
    priorBook.date > order.submittedAfter ||
    priorBook.date >= session.date ||
    Date.parse(priorBook.collectedAt) > Date.parse(order.createdAt)
  ) {
    return null;
  }

  const opposingQuantity = order.side === 'buy' ? priorBook.sellQuantity : priorBook.buyQuantity;
  if (opposingQuantity == null || !isSafeInteger(opposingQuantity) || opposingQuantity < 0) {
    return null;
  }

  return priorBook;
}

export function evaluatePaperOrder(
  order: PaperOrderForEvaluation,
  session: PaperMarketSession,
  priorBook: PaperBookSnapshot | null,
): PaperOrderEvaluation {
  if (
    !isSafeInteger(order.quantity) ||
    order.quantity <= 0 ||
    !isSafeInteger(order.filledQuantity) ||
    order.filledQuantity < 0 ||
    order.filledQuantity >= order.quantity ||
    !isSafeInteger(order.expiresAfterSessions) ||
    order.expiresAfterSessions < 1 ||
    order.expiresAfterSessions > 20 ||
    !isSafeInteger(order.evaluatedSessions) ||
    order.evaluatedSessions < 0
  ) {
    return waitingForData(order, 'invalid_order_state', session.date);
  }

  if (
    !isDateKey(session.date) ||
    !isDateKey(order.submittedAfter) ||
    session.date <= order.submittedAfter
  ) {
    return waitingForData(order, 'session_not_after_submission', session.date);
  }

  if (
    !isPositiveFiniteNumber(session.close) ||
    session.volume == null ||
    !isSafeInteger(session.volume) ||
    session.volume < 0
  ) {
    return waitingForData(order, 'missing_or_invalid_fixing_or_volume', session.date);
  }

  const book = order.mode === 'boc_prudent' ? eligibleBook(order, session, priorBook) : null;
  if (order.mode === 'boc_prudent' && !book) {
    return waitingForData(order, 'missing_eligible_boc_snapshot', session.date);
  }

  const evaluatedSessions = order.evaluatedSessions + 1;
  const remaining = order.quantity - order.filledQuantity;
  const eligibleTo = evaluatedSessions >= order.expiresAfterSessions;

  const finishWithoutFill = (reason: string): PaperOrderEvaluation => ({
    status: eligibleTo ? 'expired' : 'pending',
    fillQuantity: 0,
    fillPrice: null,
    evaluatedSessions,
    reason: eligibleTo ? 'validity_expired' : reason,
    evaluatedDate: session.date,
    bookDate: book?.date ?? null,
  });

  const limitMet =
    order.type === 'at_best' ||
    (isPositiveFiniteNumber(order.limitPrice) &&
      (order.side === 'buy'
        ? session.close <= order.limitPrice
        : session.close >= order.limitPrice));
  if (!limitMet) return finishWithoutFill('price_limit_not_met');

  let maxQuantity = remaining;
  if (session.volume === 0) {
    maxQuantity = 0;
  } else if (order.mode === 'boc_prudent') {
    const opposingQuantity = order.side === 'buy' ? book?.sellQuantity : book?.buyQuantity;
    maxQuantity = Math.min(maxQuantity, opposingQuantity ?? 0, session.volume);
  }

  if (order.side === 'buy') {
    if (!Number.isFinite(order.reservedCashRemaining) || order.reservedCashRemaining < 0) {
      return waitingForData(order, 'invalid_cash_reservation', session.date);
    }

    const affordable = Math.floor(order.reservedCashRemaining / session.close);
    if (affordable < 1) {
      return {
        status: 'cancelled',
        fillQuantity: 0,
        fillPrice: null,
        evaluatedSessions,
        reason: 'insufficient_reserved_cash',
        evaluatedDate: session.date,
        bookDate: book?.date ?? null,
      };
    }
    maxQuantity = Math.min(maxQuantity, affordable);
  } else {
    if (!isSafeInteger(order.reservedSharesRemaining) || order.reservedSharesRemaining < 0) {
      return waitingForData(order, 'invalid_share_reservation', session.date);
    }
    if (order.reservedSharesRemaining === 0) {
      return {
        status: 'cancelled',
        fillQuantity: 0,
        fillPrice: null,
        evaluatedSessions,
        reason: 'reserved_shares_exhausted',
        evaluatedDate: session.date,
        bookDate: book?.date ?? null,
      };
    }
    maxQuantity = Math.min(maxQuantity, order.reservedSharesRemaining);
  }

  const fillQuantity = Math.max(0, Math.floor(maxQuantity));
  if (fillQuantity === 0) return finishWithoutFill('no_available_simulated_liquidity');

  const remainingAfterFill = remaining - fillQuantity;
  const cashReservationExhausted =
    order.side === 'buy' &&
    order.reservedCashRemaining - fillQuantity * session.close < session.close;
  const shareReservationExhausted =
    order.side === 'sell' && order.reservedSharesRemaining === fillQuantity;
  const expiresRemainder = eligibleTo && remainingAfterFill > 0;
  const status =
    remainingAfterFill === 0
      ? 'filled'
      : cashReservationExhausted || shareReservationExhausted
        ? 'cancelled'
        : expiresRemainder
          ? 'expired'
          : 'partial';

  return {
    status,
    fillQuantity,
    fillPrice: session.close,
    evaluatedSessions,
    reason:
      status === 'filled'
        ? 'filled'
        : status === 'cancelled'
          ? cashReservationExhausted
            ? 'cash_reservation_exhausted'
            : 'reserved_shares_exhausted'
          : status === 'expired'
            ? 'validity_expired'
            : 'partial_fill',
    evaluatedDate: session.date,
    bookDate: book?.date ?? null,
  };
}
