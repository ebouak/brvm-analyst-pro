import { Account, Position, Stats } from './types';

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
  ): Promise<{ positions: Position[]; account: Account | null }> {
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
