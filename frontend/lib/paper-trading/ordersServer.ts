import 'server-only';

import { getServiceClient } from '@/lib/billing/serviceClient';
import { fetchAllRows } from '@/lib/supabase/paginate';
import {
  evaluatePaperOrder,
  type PaperBookSnapshot,
  type PaperMarketSession,
  type PaperOrderStatus,
  type PlacePaperOrderInput,
} from './orders';
import type { PaperFill, PaperOrder } from './types';

const ACTIVE_STATUSES = ['pending', 'partial', 'waiting_data'] as const;
const PAGE_SIZE = 1000;
const MAX_SESSION_PAGES = 20;

export class PaperOrderServiceError extends Error {
  constructor(
    readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = 'PaperOrderServiceError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Invalid ${label} record`);
  return value;
}

function stringField(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid ${key} in paper trading data`);
  }
  return value;
}

function nullableStringField(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (value == null) return null;
  if (typeof value !== 'string') throw new Error(`Invalid ${key} in paper trading data`);
  return value;
}

function numberField(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${key} in paper trading data`);
  return parsed;
}

function integerField(source: Record<string, unknown>, key: string): number {
  const value = numberField(source, key);
  if (!Number.isSafeInteger(value)) throw new Error(`Invalid ${key} in paper trading data`);
  return value;
}

function nullableNumberField(source: Record<string, unknown>, key: string): number | null {
  return source[key] == null ? null : numberField(source, key);
}

function booleanField(source: Record<string, unknown>, key: string): boolean {
  const value = source[key];
  if (typeof value !== 'boolean') throw new Error(`Invalid ${key} in paper trading data`);
  return value;
}

function enumField<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  for (const candidate of allowed) {
    if (value === candidate) return candidate;
  }
  throw new Error(`Invalid ${label} in paper trading data`);
}

function isTerminalStatus(status: PaperOrderStatus): boolean {
  return status === 'filled' || status === 'expired' || status === 'cancelled';
}

function mapBookSnapshot(source: Record<string, unknown>): PaperBookSnapshot | null {
  const date = nullableStringField(source, 'boc_date');
  if (date === null) return null;

  return {
    date,
    collectedAt: stringField(source, 'boc_collected_at'),
    buyQuantity: nullableNumberField(source, 'boc_buy_quantity'),
    buyPrice: nullableNumberField(source, 'boc_buy_price'),
    sellQuantity: nullableNumberField(source, 'boc_sell_quantity'),
    sellPrice: nullableNumberField(source, 'boc_sell_price'),
    buyAtMarket: booleanField(source, 'boc_buy_at_market'),
    sellAtMarket: booleanField(source, 'boc_sell_at_market'),
  };
}

function mapPaperOrder(value: unknown): PaperOrder {
  const source = record(value, 'paper order');

  return {
    id: stringField(source, 'id'),
    userId: stringField(source, 'user_id'),
    accountId: stringField(source, 'account_id'),
    code: stringField(source, 'code'),
    side: enumField(source.side, ['buy', 'sell'], 'side'),
    type: enumField(source.order_type, ['at_best', 'limit'], 'order type'),
    mode: enumField(source.execution_mode, ['fixing', 'boc_prudent'], 'execution mode'),
    status: enumField(
      source.status,
      ['pending', 'partial', 'filled', 'expired', 'cancelled', 'waiting_data'],
      'status',
    ),
    limitPrice: nullableNumberField(source, 'limit_price'),
    quantity: integerField(source, 'quantity'),
    filledQuantity: integerField(source, 'filled_quantity'),
    expiresAfterSessions: integerField(source, 'expires_after_sessions'),
    evaluatedSessions: integerField(source, 'evaluated_sessions'),
    submittedAfter: stringField(source, 'submitted_after'),
    createdAt: stringField(source, 'created_at'),
    updatedAt: stringField(source, 'updated_at'),
    lastEvaluatedDate: nullableStringField(source, 'last_evaluated_date'),
    reservedCashRemaining: numberField(source, 'reserved_cash_remaining'),
    reservedSharesRemaining: integerField(source, 'reserved_shares_remaining'),
    reason: nullableStringField(source, 'waiting_reason'),
    bookSnapshot: mapBookSnapshot(source),
  };
}

function mapPaperFill(value: unknown): PaperFill {
  const source = record(value, 'paper fill');
  return {
    id: stringField(source, 'id'),
    orderId: stringField(source, 'order_id'),
    code: stringField(source, 'code'),
    date: stringField(source, 'date_marche'),
    quantity: integerField(source, 'quantity'),
    price: numberField(source, 'price'),
    mode: enumField(source.execution_mode, ['fixing', 'boc_prudent'], 'execution mode'),
    bookDate: nullableStringField(source, 'boc_date'),
    createdAt: stringField(source, 'created_at'),
  };
}

function operationPayload(value: unknown): Record<string, unknown> {
  const payload = record(value, 'paper order operation');
  if (payload.ok !== true) {
    const code = typeof payload.error === 'string' ? payload.error : 'OPERATION_FAILED';
    throw new PaperOrderServiceError(code);
  }
  return payload;
}

function orderFromOperation(value: unknown): PaperOrder {
  const payload = operationPayload(value);
  return mapPaperOrder(payload.order);
}

async function futureMarketDates(after: string, maximum: number): Promise<string[]> {
  const supabase = getServiceClient();
  const dates = new Set<string>();

  for (let page = 0; page < MAX_SESSION_PAGES && dates.size < maximum; page += 1) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('brvm_actions_daily')
      .select('date_marche, code')
      .gt('date_marche', after)
      .order('date_marche', { ascending: true })
      .order('code', { ascending: true })
      .range(from, to);
    if (error) throw new Error(`Unable to read paper trading sessions: ${error.message}`);

    const rows = data ?? [];
    for (const value of rows) {
      const row = record(value, 'market session');
      dates.add(stringField(row, 'date_marche'));
      if (dates.size >= maximum) break;
    }

    if (rows.length < PAGE_SIZE) return [...dates].slice(0, maximum);
  }

  if (dates.size < maximum) {
    throw new Error('Paper trading session pagination limit reached');
  }
  return [...dates].slice(0, maximum);
}

async function markWaiting(
  userId: string,
  orderId: string,
  date: string,
  reason: string,
): Promise<void> {
  const { data, error } = await getServiceClient().rpc('paper_marquer_attente_donnees', {
    p_user: userId,
    p_order_id: orderId,
    p_date_marche: date,
    p_reason: reason,
  });
  if (error) throw new Error(`Unable to mark paper order waiting for data: ${error.message}`);
  operationPayload(data);
}

export async function listPaperOrders(userId: string): Promise<{
  orders: PaperOrder[];
  fills: PaperFill[];
}> {
  const supabase = getServiceClient();
  const [orders, fills] = await Promise.all([
    fetchAllRows(async (from, to) => {
      const result = await supabase
        .from('paper_trading_orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);
      if (result.error) {
        throw new Error(`Unable to list paper orders: ${result.error.message}`);
      }
      return result;
    }),
    fetchAllRows(async (from, to) => {
      const result = await supabase
        .from('paper_trading_fills')
        .select('*')
        .eq('user_id', userId)
        .order('date_marche', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);
      if (result.error) {
        throw new Error(`Unable to list paper fills: ${result.error.message}`);
      }
      return result;
    }),
  ]);

  return {
    orders: orders.map(mapPaperOrder),
    fills: fills.map(mapPaperFill),
  };
}

export async function placePaperOrder(
  userId: string,
  input: PlacePaperOrderInput,
): Promise<PaperOrder> {
  const { data, error } = await getServiceClient().rpc('paper_placer_ordre', {
    p_user: userId,
    p_code: input.code,
    p_side: input.side,
    p_type: input.type,
    p_mode: input.mode,
    p_quantity: input.quantity,
    p_limit_price: input.limitPrice,
    p_expires_after_sessions: input.expiresAfterSessions,
  });
  if (error) throw new Error(`Unable to place paper order: ${error.message}`);
  return orderFromOperation(data);
}

export async function cancelPaperOrder(userId: string, orderId: string): Promise<PaperOrder> {
  const { data, error } = await getServiceClient().rpc('paper_annuler_ordre', {
    p_user: userId,
    p_order_id: orderId,
  });
  if (error) throw new Error(`Unable to cancel paper order: ${error.message}`);
  return orderFromOperation(data);
}

export async function settlePaperOrders(userId: string): Promise<void> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('paper_trading_orders')
    .select('*')
    .eq('user_id', userId)
    .in('status', [...ACTIVE_STATUSES])
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw new Error(`Unable to read open paper orders: ${error.message}`);

  const orders = (data ?? []).map(mapPaperOrder);
  for (const originalOrder of orders) {
    let order = originalOrder;
    const dates = await futureMarketDates(order.submittedAfter, order.expiresAfterSessions);

    for (const date of dates) {
      if (order.lastEvaluatedDate && date <= order.lastEvaluatedDate) continue;
      if (isTerminalStatus(order.status)) break;

      const { data: marketRow, error: marketError } = await supabase
        .from('brvm_actions_daily')
        .select('cours_jour, volume')
        .eq('code', order.code)
        .eq('date_marche', date)
        .maybeSingle();
      if (marketError) throw new Error(`Unable to read ${order.code} market data: ${marketError.message}`);

      const market = marketRow ? record(marketRow, 'paper trading market row') : null;
      const close = market ? nullableNumberField(market, 'cours_jour') : null;
      const volume = market ? nullableNumberField(market, 'volume') : null;
      if (!market || close == null || volume == null) {
        await markWaiting(
          userId,
          order.id,
          date,
          !marketRow
            ? 'missing_market_session_quote'
            : close == null
              ? 'missing_fixing'
              : 'missing_traded_volume',
        );
        break;
      }

      const session: PaperMarketSession = {
        date,
        close,
        volume,
      };
      const evaluation = evaluatePaperOrder(order, session, order.bookSnapshot);
      if (evaluation.status === 'waiting_data') {
        await markWaiting(userId, order.id, date, evaluation.reason);
        break;
      }

      const { data: result, error: applyError } = await supabase.rpc(
        'paper_appliquer_remplissage',
        {
          p_user: userId,
          p_order_id: order.id,
          p_date_marche: date,
          p_quantity: evaluation.fillQuantity,
          p_price: evaluation.fillPrice,
          p_mode: order.mode,
        },
      );
      if (applyError) {
        throw new Error(`Unable to settle paper order ${order.id}: ${applyError.message}`);
      }
      const settlement = operationPayload(result);
      if (settlement.already_evaluated === true) break;
      order = mapPaperOrder(settlement.order);
      if (isTerminalStatus(order.status)) break;
    }
  }
}
