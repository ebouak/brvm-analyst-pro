export interface Account {
  id: string;
  user_id: string;
  capital_initial: number;
  capital_current: number;
  pnl_total: number;
  pnl_pct: number;
  created_at: string;
  updated_at: string;
}

export interface Position {
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

/**
 * Position ouverte enrichie par l'API (`/api/paper-trading/positions`) :
 * `current_price` (cours du jour) et `current_value` (cours × quantité) sont
 * calculés côté serveur ; `pnl`/`pnl_pct` portent alors le P&L LATENT.
 */
export interface OpenPosition extends Position {
  current_price: number;
  current_value: number;
}

export interface Stats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
}
