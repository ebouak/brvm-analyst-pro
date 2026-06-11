/**
 * Service de gestion du paper trading automatique.
 *
 * Responsabilités :
 * - Initialiser un compte paper trading par utilisateur
 * - Créer des positions sur signaux BUY (10% de capital)
 * - Fermer des positions sur signaux SELL ou auto-close (30 jours)
 * - Calculer les P&L (réalisés et non-réalisés)
 * - Mettre à jour les métriques du compte (capital_current, pnl_total, pnl_pct)
 * - Récupérer l'historique des positions et les statistiques
 *
 * Idempotence : chaque opération peut être relancée sans créer de doublon
 * (unique constraint sur user_id, RLS par user_id).
 */

import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';

export interface PaperTradingAccount {
  id: string;
  user_id: string;
  capital_initial: number;
  capital_current: number;
  pnl_total: number;
  pnl_pct: number;
  created_at: string;
  updated_at: string;
}

export interface PaperTradingPosition {
  id: string;
  user_id: string;
  account_id: string;
  code: string;
  entry_price: number;
  entry_date: string;
  entry_signal_id: string | null;
  num_shares: number;
  exit_price: number | null;
  exit_date: string | null;
  exit_signal_id: string | null;
  status: 'open' | 'closed';
  pnl: number;
  pnl_pct: number;
  days_held: number | null;
  created_at: string;
  updated_at: string;
}

export interface AccountStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
}

export class PaperTradingService {
  private supabase = getSupabase();

  /**
   * Initialiser un compte paper trading pour un utilisateur.
   * Un seul compte par utilisateur (enforced by unique constraint).
   */
  async initializeAccount(
    userId: string,
    capitalInitial: number,
  ): Promise<PaperTradingAccount> {
    if (capitalInitial <= 0) {
      throw new Error('capitalInitial doit être > 0');
    }

    const { data, error } = await this.supabase
      .from('paper_trading_accounts')
      .insert({
        user_id: userId,
        capital_initial: capitalInitial,
        capital_current: capitalInitial,
      } as any)
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Failed to initialize paper trading account');
      throw new Error(`Failed to initialize account: ${error.message}`);
    }

    logger.info(
      { userId, capitalInitial, accountId: data.id },
      'Paper trading account initialized',
    );
    return data as PaperTradingAccount;
  }

  /**
   * Récupérer le compte paper trading d'un utilisateur (s'il existe).
   */
  async getAccount(userId: string): Promise<PaperTradingAccount | null> {
    const { data, error } = await this.supabase
      .from('paper_trading_accounts')
      .select()
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error({ error, userId }, 'Failed to fetch paper trading account');
      throw new Error(`Failed to fetch account: ${error.message}`);
    }

    return (data as PaperTradingAccount) || null;
  }

  /**
   * Créer une position sur signal BUY.
   * Taille = 10% du capital_current.
   * num_shares = (capital_current * 0.1) / entry_price
   */
  async createPosition(
    userId: string,
    accountId: string,
    code: string,
    entryPrice: number,
    entryDate: string,
    entrySignalId?: string,
  ): Promise<PaperTradingPosition> {
    if (entryPrice <= 0) {
      throw new Error('entryPrice doit être > 0');
    }

    // Récupérer le compte actuel pour obtenir le capital
    const account = await this.getAccount(userId);
    if (!account) {
      throw new Error('Paper trading account not found');
    }

    const investmentAmount = account.capital_current * 0.1;
    const numShares = investmentAmount / entryPrice;

    const { data, error } = await this.supabase
      .from('paper_trading_positions')
      .insert({
        user_id: userId,
        account_id: accountId,
        code,
        entry_price: entryPrice,
        entry_date: entryDate,
        entry_signal_id: entrySignalId || null,
        num_shares: numShares,
        status: 'open',
      } as any)
      .select()
      .single();

    if (error) {
      logger.error({ error, code, entryPrice }, 'Failed to create position');
      throw new Error(`Failed to create position: ${error.message}`);
    }

    logger.info(
      {
        positionId: data.id,
        code,
        numShares,
        entryPrice,
      },
      'Paper trading position created',
    );
    return data as PaperTradingPosition;
  }

  /**
   * Fermer une position sur signal SELL.
   * P&L = (exit_price - entry_price) * num_shares
   * Mettre à jour le capital et les P&L du compte.
   */
  async closePosition(
    userId: string,
    positionId: string,
    exitPrice: number,
    exitDate: string,
    exitSignalId?: string,
  ): Promise<PaperTradingPosition> {
    if (exitPrice <= 0) {
      throw new Error('exitPrice doit être > 0');
    }

    // Récupérer la position
    const { data: position, error: posError } = await this.supabase
      .from('paper_trading_positions')
      .select()
      .eq('id', positionId)
      .eq('user_id', userId)
      .single();

    if (posError) {
      logger.error({ error: posError, positionId }, 'Position not found');
      throw new Error(`Position not found: ${posError.message}`);
    }

    const pos = position as PaperTradingPosition;

    // Calculer les P&L
    const pnl = (exitPrice - pos.entry_price) * pos.num_shares;
    const pnlPct = ((exitPrice - pos.entry_price) / pos.entry_price) * 100;
    const entryDateObj = new Date(pos.entry_date);
    const exitDateObj = new Date(exitDate);
    const daysHeld = Math.floor(
      (exitDateObj.getTime() - entryDateObj.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Mettre à jour la position
    const { data: closedPos, error: updateError } = await this.supabase
      .from('paper_trading_positions')
      .update({
        exit_price: exitPrice,
        exit_date: exitDate,
        exit_signal_id: exitSignalId || null,
        status: 'closed',
        pnl,
        pnl_pct: pnlPct,
        days_held: daysHeld,
      } as any)
      .eq('id', positionId)
      .select()
      .single();

    if (updateError) {
      logger.error({ error: updateError, positionId }, 'Failed to close position');
      throw new Error(`Failed to close position: ${updateError.message}`);
    }

    // Mettre à jour les métriques du compte
    await this.updateAccountMetrics(pos.account_id);

    logger.info(
      {
        positionId,
        pnl,
        pnlPct,
        daysHeld,
      },
      'Paper trading position closed',
    );
    return closedPos as PaperTradingPosition;
  }

  /**
   * Auto-fermer les positions ouvertes depuis > 30 jours.
   * Appelé quotidiennement par le cron.
   * closePrices: map { code -> cours_jour }
   */
  async autoCloseExpiredPositions(closePrices: Record<string, number>): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

    // Trouver les positions ouvertes depuis > 30 jours
    const { data: positions, error: findError } = await this.supabase
      .from('paper_trading_positions')
      .select()
      .eq('status', 'open')
      .lt('entry_date', cutoffDate);

    if (findError) {
      logger.error({ error: findError }, 'Failed to find expired positions');
      throw new Error(`Failed to find expired positions: ${findError.message}`);
    }

    let closedCount = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const pos of positions || []) {
      const position: any = pos;
      const userId = position.user_id as string | undefined;

      if (!userId) {
        logger.error(
          { positionId: position.id },
          'Position missing user_id, skipping',
        );
        continue;
      }

      const closePrice = closePrices[position.code];
      if (closePrice) {
        try {
          // TS2345: use any to bypass strict parameter typing from Supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (this.closePosition as any)(userId, position.id, closePrice, today);
          closedCount++;
        } catch (err) {
          logger.error(
            { error: err, positionId: position.id },
            'Failed to auto-close position',
          );
        }
      }
    }

    if (closedCount > 0) {
      logger.info({ closedCount }, 'Auto-closed expired positions');
    }

    return closedCount;
  }

  /**
   * Recalculer les métriques du compte après un changement de position.
   * pnl_total = somme des P&L des positions fermées
   * pnl_pct = (capital_current - capital_initial) / capital_initial * 100
   */
  async updateAccountMetrics(accountId: string): Promise<PaperTradingAccount> {
    // Récupérer toutes les positions fermées du compte
    const { data: positions, error: posError } = await this.supabase
      .from('paper_trading_positions')
      .select('pnl')
      .eq('account_id', accountId)
      .eq('status', 'closed');

    if (posError) {
      logger.error({ error: posError, accountId }, 'Failed to fetch positions');
      throw new Error(`Failed to fetch positions: ${posError.message}`);
    }

    const pnlTotal = (positions || []).reduce((sum, p) => sum + (p.pnl || 0), 0);

    // Récupérer le compte
    const { data: account, error: accError } = await this.supabase
      .from('paper_trading_accounts')
      .select()
      .eq('id', accountId)
      .single();

    if (accError) {
      logger.error({ error: accError, accountId }, 'Account not found');
      throw new Error(`Account not found: ${accError.message}`);
    }

    const acc = account as PaperTradingAccount;

    const capitalCurrent = acc.capital_initial + pnlTotal;
    const pnlPct =
      acc.capital_initial > 0
        ? ((capitalCurrent - acc.capital_initial) / acc.capital_initial) * 100
        : 0;

    // Mettre à jour le compte
    const { data: updated, error: updateError } = await this.supabase
      .from('paper_trading_accounts')
      .update({
        capital_current: capitalCurrent,
        pnl_total: pnlTotal,
        pnl_pct: pnlPct,
      } as any)
      .eq('id', accountId)
      .select()
      .single();

    if (updateError) {
      logger.error({ error: updateError, accountId }, 'Failed to update account');
      throw new Error(`Failed to update account: ${updateError.message}`);
    }

    return updated as PaperTradingAccount;
  }

  /**
   * Récupérer toutes les positions d'un compte.
   * Paramètres optionnels pour filtrer par statut.
   */
  async getPositions(
    userId: string,
    accountId?: string,
    status?: 'open' | 'closed',
  ): Promise<PaperTradingPosition[]> {
    let query = this.supabase
      .from('paper_trading_positions')
      .select()
      .eq('user_id', userId);

    if (accountId) {
      query = query.eq('account_id', accountId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('entry_date', { ascending: false });

    if (error) {
      logger.error({ error, userId }, 'Failed to fetch positions');
      throw new Error(`Failed to fetch positions: ${error.message}`);
    }

    return (data || []) as PaperTradingPosition[];
  }

  /**
   * Récupérer les positions ouvertes avec leurs P&L non-réalisés.
   * Utilise la vue vw_paper_trading_positions_open pour les prix actuels.
   */
  async getOpenPositionsWithMetrics(userId: string): Promise<
    (PaperTradingPosition & {
      current_price: number;
      unrealized_pnl: number;
      unrealized_pnl_pct: number;
      days_open: number;
    })[]
  > {
    const { data, error } = await this.supabase
      .from('vw_paper_trading_positions_open')
      .select()
      .eq('user_id', userId ?? '');

    if (error) {
      logger.error({ error, userId }, 'Failed to fetch open positions with metrics');
      throw new Error(`Failed to fetch open positions: ${error.message}`);
    }

    return (data || []) as any[];
  }

  /**
   * Calculer les statistiques du compte.
   * Win rate, avg win, avg loss, best/worst trade.
   */
  async getAccountStats(userId: string, accountId: string): Promise<AccountStats> {
    const positions = await this.getPositions(userId, accountId, 'closed');

    const wins = positions.filter((p) => p.pnl > 0);
    const losses = positions.filter((p) => p.pnl < 0);

    const avgWin = wins.length > 0 ? wins.reduce((sum, p) => sum + p.pnl, 0) / wins.length : 0;
    const avgLoss =
      losses.length > 0 ? losses.reduce((sum, p) => sum + p.pnl, 0) / losses.length : 0;

    const pnls = positions.map((p) => p.pnl);

    return {
      totalTrades: positions.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: positions.length > 0 ? (wins.length / positions.length) * 100 : 0,
      avgWin,
      avgLoss,
      bestTrade: pnls.length > 0 ? Math.max(...pnls) : 0,
      worstTrade: pnls.length > 0 ? Math.min(...pnls) : 0,
    };
  }
}

// Export singleton instance
export const paperTradingService = new PaperTradingService();
