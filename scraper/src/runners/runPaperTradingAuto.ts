import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../logger.js';

// Client non typé par schéma (les génériques stricts de supabase-js 2.108+
// rendraient chaque .from() "never" sans codegen de types DB).
type Db = SupabaseClient<any, any, any>;

const log = logger.child({ module: 'runPaperTradingAuto' });

interface SignalDaily {
  id: number;
  code: string;
  date_marche: string;
  score_total: number;
}

interface PaperTradingAccount {
  id: string;
  user_id: string;
  capital_initial: number;
  capital_current: number;
}

const SIGNAL_THRESHOLD = 0.6; // 60% confidence minimum to auto-open
const POSITION_SIZE_PCT = 0.1; // Risquer 10% du capital par position

export async function runPaperTradingAuto(): Promise<{
  status: 'success' | 'partial' | 'error';
  opened: number;
  skipped: number;
  errors: string[];
}> {
  log.info('Starting auto paper trading (open positions from signals)');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const errors: string[] = [];
  let opened = 0;
  let skipped = 0;

  try {
    // Dernière séance scorée (les signaux peuvent dater de la veille un week-end)
    const { data: lastSig } = await supabase
      .from('signals_daily')
      .select('date_marche')
      .order('date_marche', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastSig) {
      log.info('No signals in database yet');
      return { status: 'success', opened: 0, skipped: 0, errors: [] };
    }
    const today = lastSig.date_marche as string;

    // Signaux d'achat forts de la séance : BUY, score >= seuil, confiance suffisante
    // (schéma réel signals_daily : signal/score_total/confiance — cf. scoring §9)
    const { data: signals, error: signalError } = await supabase
      .from('signals_daily')
      .select('id, code, date_marche, score_total')
      .eq('date_marche', today)
      .eq('signal', 'BUY')
      .gte('score_total', SIGNAL_THRESHOLD)
      .gte('confiance', 0.4)
      .order('score_total', { ascending: false });

    if (signalError) {
      throw new Error(`Failed to fetch signals: ${signalError.message}`);
    }

    if (!signals || signals.length === 0) {
      log.info(`No strong BUY signals for ${today} (threshold: ${SIGNAL_THRESHOLD})`);
      return { status: 'success', opened: 0, skipped: 0, errors: [] };
    }

    log.info({ count: signals.length }, 'Strong signals found today');

    // Process each signal
    for (const signal of signals) {
      try {
        await processSignal(
          supabase,
          signal,
          today
        );
        opened++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn({ code: signal.code, error: msg }, 'Failed to open position');
        errors.push(`${signal.code}: ${msg}`);
        skipped++;
      }
    }

    log.info(
      { opened, skipped, errors: errors.length },
      '✅ Auto paper trading completed'
    );

    return {
      status: errors.length === 0 ? 'success' : 'partial',
      opened,
      skipped,
      errors,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error({ error: msg }, '❌ Auto paper trading failed');
    return {
      status: 'error',
      opened: 0,
      skipped: 0,
      errors: [msg],
    };
  }
}

async function processSignal(
  supabase: Db,
  signal: SignalDaily,
  today: string
): Promise<void> {
  // Fetch latest price
  const { data: price, error: priceError } = await supabase
    .from('brvm_actions_daily')
    .select('cours_jour, code')
    .eq('code', signal.code)
    .eq('date_marche', today)
    .single();

  if (priceError || !price?.cours_jour) {
    throw new Error(`No price data for ${signal.code}`);
  }

  // Check if position already exists for this signal
  const { data: existing } = await supabase
    .from('paper_trading_positions')
    .select('id')
    .eq('entry_signal_id', signal.id)
    .single();

  if (existing) {
    log.debug({ code: signal.code }, 'Position already exists for this signal');
    throw new Error('Position already exists for this signal');
  }

  // Get all paper trading accounts (service_role can see all)
  const { data: accounts, error: accountError } = await supabase
    .from('paper_trading_accounts')
    .select('id, user_id, capital_current')
    .gt('capital_current', 0);

  if (accountError) {
    throw new Error(`Failed to fetch accounts: ${accountError.message}`);
  }

  if (!accounts || accounts.length === 0) {
    log.warn('No active paper trading accounts');
    return;
  }

  // Open position for each active account
  for (const account of accounts) {
    const shareCount = Math.floor(
      (account.capital_current * POSITION_SIZE_PCT) / price.cours_jour
    );

    if (shareCount < 1) {
      log.debug(
        { user_id: account.user_id, capital: account.capital_current },
        'Insufficient capital for position'
      );
      continue;
    }

    const { error: insertError } = await supabase
      .from('paper_trading_positions')
      .insert({
        account_id: account.id,
        user_id: account.user_id,
        code: signal.code,
        num_shares: shareCount,
        entry_price: price.cours_jour,
        entry_date: today,
        entry_signal_id: signal.id,
        status: 'open',
        pnl: 0,
        pnl_pct: 0,
      });

    if (insertError) {
      throw new Error(
        `Failed to insert position for user ${account.user_id}: ${insertError.message}`
      );
    }

    log.info(
      {
        user_id: account.user_id,
        code: signal.code,
        shares: shareCount,
        entry_price: price.cours_jour,
      },
      '✅ Position opened'
    );
  }
}
