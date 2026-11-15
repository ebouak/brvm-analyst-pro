import { Account, Stats } from './types';
import type {
  PaperFill,
  PaperOrder,
  PaperTradableAction,
  PaperTradingPositionsResponse,
} from './types';
import type { PlacePaperOrderInput } from './orders';

export interface InitAccountRequest {
  capital_initial: number;
}

export class PaperTradingClientService {
  async initializeAccount(capitalInitial: number): Promise<Account> {
    const res = await fetch('/api/paper-trading/init', {
      method: 'POST',
      body: JSON.stringify({ capital_initial: capitalInitial }),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to initialize account');
    }

    const json = await res.json();
    return json.account;
  }

  async getPositions(
    status?: 'open' | 'closed'
  ): Promise<PaperTradingPositionsResponse> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);

    const res = await fetch(
      `/api/paper-trading/positions?${params}`,
      {
        method: 'GET',
      }
    );

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to fetch positions');
    }

    return res.json();
  }

  async getOrders(): Promise<{ orders: PaperOrder[]; fills: PaperFill[] }> {
    const res = await fetch('/api/paper-trading/orders', { method: 'GET' });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Impossible de charger les ordres.');
    }
    return res.json();
  }

  async getTradable(): Promise<{ sessionDate: string | null; actions: PaperTradableAction[] }> {
    const res = await fetch('/api/paper-trading/tradable', { method: 'GET' });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Impossible de charger les valeurs négociables.');
    }
    return res.json();
  }

  async placeOrder(input: PlacePaperOrderInput): Promise<PaperOrder> {
    const res = await fetch('/api/paper-trading/orders', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Impossible de passer cet ordre simulé.');
    }
    const json = await res.json();
    return json.order;
  }

  async cancelOrder(id: string): Promise<PaperOrder> {
    const res = await fetch(`/api/paper-trading/orders/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Impossible d’annuler cet ordre.');
    }
    const json = await res.json();
    return json.order;
  }

  async getStats(): Promise<{ stats: Stats | null; account: Account | null }> {
    const res = await fetch('/api/paper-trading/stats', {
      method: 'GET',
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to fetch stats');
    }

    return res.json();
  }
}

export const paperTradingService = new PaperTradingClientService();
