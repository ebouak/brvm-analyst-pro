import type {
  PaperBookSnapshot,
  PaperExecutionMode,
  PaperOrderForEvaluation,
  PaperOrderStatus,
} from './orders';

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

export interface PaperOpenPosition extends Omit<OpenPosition, 'status'> {
  status: 'open';
  current_price_date: string;
  reservedShares: number;
  availableShares: number;
}

export type PaperClosedPosition = Position & { status: 'closed' };
export type PaperPosition = PaperOpenPosition | PaperClosedPosition;

export interface PaperOrder extends PaperOrderForEvaluation {
  userId: string;
  accountId: string;
  code: string;
  status: PaperOrderStatus;
  updatedAt: string;
  lastEvaluatedDate: string | null;
  reason: string | null;
  bookSnapshot: PaperBookSnapshot | null;
}

export interface PaperFill {
  id: string;
  orderId: string;
  code: string;
  date: string;
  quantity: number;
  price: number;
  mode: PaperExecutionMode;
  bookDate: string | null;
  createdAt: string;
}

export interface PaperBookContext extends PaperBookSnapshot {}

export interface PaperTradableAction {
  code: string;
  designation: string | null;
  cours_jour: number | null;
  book: PaperBookSnapshot | null;
}

export interface PaperTradingPositionsResponse {
  positions: PaperPosition[];
  account: Account | null;
  cashAvailable: number | null;
  cashReserved: number | null;
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
