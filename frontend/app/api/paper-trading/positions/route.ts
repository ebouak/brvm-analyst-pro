import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { settlePaperOrders } from '@/lib/paper-trading/ordersServer';
import { fetchAllRows } from '@/lib/supabase/paginate';

const PAGE_SIZE = 1000;
const MAX_QUOTE_PAGES = 20;
const ACTIVE_ORDER_STATUSES = ['pending', 'partial', 'waiting_data'] as const;

interface PositionRow {
  id: string;
  code: string;
  entry_price: number;
  entry_date: string;
  num_shares: number;
  status: 'open' | 'closed';
  [key: string]: unknown;
}

interface LatestQuote {
  code: string;
  date_marche: string;
  cours_jour: number;
}

async function loadLatestQuotes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  codes: string[],
): Promise<Map<string, LatestQuote>> {
  const quotes = new Map<string, LatestQuote>();

  for (let page = 0; page < MAX_QUOTE_PAGES && quotes.size < codes.length; page += 1) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('brvm_actions_daily')
      .select('code, date_marche, cours_jour')
      .in('code', codes)
      .not('cours_jour', 'is', null)
      .order('date_marche', { ascending: false })
      .order('code', { ascending: true })
      .range(from, to);
    if (error) throw new Error(`Impossible de charger les cours du portefeuille : ${error.message}`);

    const rows = data ?? [];
    for (const row of rows) {
      if (!quotes.has(row.code)) {
        quotes.set(row.code, {
          code: row.code,
          date_marche: row.date_marche,
          cours_jour: row.cours_jour,
        });
      }
    }

    if (rows.length < PAGE_SIZE) break;
  }

  const missing = codes.filter((code) => !quotes.has(code));
  if (missing.length > 0) {
    throw new Error(`Cours de référence introuvable pour : ${missing.join(', ')}`);
  }
  return quotes;
}

export async function POST() {
  return NextResponse.json(
    { error: 'Les achats et ventes passent désormais par des ordres simulés.' },
    { status: 405 },
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
    }

    await settlePaperOrders(user.id);

    const { data: account, error: accountError } = await supabase
      .from('paper_trading_accounts')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (accountError) {
      console.error('Failed to fetch paper trading account:', accountError);
      return NextResponse.json({ error: 'Échec chargement du compte.' }, { status: 500 });
    }
    if (!account) {
      return NextResponse.json(
        { positions: [], account: null, cashAvailable: null, cashReserved: null },
        { status: 200 },
      );
    }

    const { data: positions, error: positionsError } = await supabase
      .from('paper_trading_positions')
      .select('*')
      .eq('account_id', account.id)
      .order('entry_date', { ascending: false })
      .order('id', { ascending: false });
    if (positionsError) {
      console.error('Failed to fetch paper trading positions:', positionsError);
      return NextResponse.json({ error: 'Échec chargement des positions.' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const requestedStatus = searchParams.get('status');
    if (requestedStatus && requestedStatus !== 'open' && requestedStatus !== 'closed') {
      return NextResponse.json({ error: 'Filtre de position invalide.' }, { status: 400 });
    }

    const rows = (positions ?? []) as PositionRow[];
    const openRows = rows.filter((position) => position.status === 'open');
    const openCodes = [...new Set(openRows.map((position) => position.code))];
    const latestQuotes = openCodes.length
      ? await loadLatestQuotes(supabase, openCodes)
      : new Map<string, LatestQuote>();

    let ordersError: { message: string } | null = null;
    const activeOrders = await fetchAllRows(async (from, to) => {
      const result = await supabase
        .from('paper_trading_orders')
        .select('id, code, side, reserved_cash_remaining, reserved_shares_remaining')
        .eq('account_id', account.id)
        .in('status', [...ACTIVE_ORDER_STATUSES])
        .order('id', { ascending: true })
        .range(from, to);
      ordersError = result.error;
      return result;
    });
    if (ordersError) {
      console.error('Failed to fetch paper trading order reservations:', ordersError);
      return NextResponse.json({ error: 'Échec chargement des réservations.' }, { status: 500 });
    }

    let cashReserved = 0;
    const sharesReserved = new Map<string, number>();
    for (const order of activeOrders ?? []) {
      if (order.side === 'buy') {
        cashReserved += order.reserved_cash_remaining ?? 0;
      } else if (order.side === 'sell') {
        sharesReserved.set(
          order.code,
          (sharesReserved.get(order.code) ?? 0) + (order.reserved_shares_remaining ?? 0),
        );
      }
    }

    const openCost = openRows.reduce(
      (total, position) => total + position.entry_price * position.num_shares,
      0,
    );
    const cashAvailable = account.capital_current - openCost - cashReserved;
    if (!Number.isFinite(cashAvailable) || cashAvailable < 0) {
      throw new Error('Paper trading cash reservations exceed the account balance.');
    }

    const enriched = rows.map((position) => {
      if (position.status !== 'open') return position;
      const quote = latestQuotes.get(position.code);
      if (!quote) throw new Error(`Missing latest quote for open position ${position.code}.`);

      const reservedShares = sharesReserved.get(position.code) ?? 0;
      const availableShares = Math.max(0, position.num_shares - reservedShares);
      const currentValue = quote.cours_jour * position.num_shares;
      const cost = position.entry_price * position.num_shares;
      const latentPnl = currentValue - cost;
      return {
        ...position,
        current_price: quote.cours_jour,
        current_value: currentValue,
        current_price_date: quote.date_marche,
        reservedShares,
        availableShares,
        pnl: latentPnl,
        pnl_pct: cost > 0 ? (latentPnl / cost) * 100 : 0,
      };
    });

    return NextResponse.json(
      {
        positions: requestedStatus
          ? enriched.filter((position) => position.status === requestedStatus)
          : enriched,
        account,
        cashAvailable,
        cashReserved,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Paper trading positions error:', error);
    return NextResponse.json({ error: 'Échec chargement du portefeuille.' }, { status: 500 });
  }
}
