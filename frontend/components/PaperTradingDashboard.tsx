'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fmtNumber, fmtFcfa } from '@/lib/format';
import { paperTradingService } from '@/lib/paper-trading/service';
import { Account, Position, Stats } from '@/lib/paper-trading/types';
import { PaperTradingJournal } from './PaperTradingJournal';

export function PaperTradingDashboard() {
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [posData, statsData] = await Promise.all([
          paperTradingService.getPositions(),
          paperTradingService.getStats(),
        ]);

        setPositions(posData.positions);
        setAccount(posData.account);
        setStats(statsData.stats);
      } catch (error) {
        console.error('Failed to load paper trading data:', error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="text-muted text-center py-8">Chargement...</div>
    );
  }

  if (!account) {
    return (
      <div className="text-muted text-center py-8">
        Compte non initialisé
      </div>
    );
  }

  // Build equity curve from closed positions
  const equityCurve = positions
    .filter((p) => p.status === 'closed')
    .sort(
      (a, b) =>
        new Date(a.exit_date!).getTime() - new Date(b.exit_date!).getTime()
    )
    .reduce(
      (acc: any[], pos) => {
        const prevEquity =
          acc.length > 0 ? acc[acc.length - 1].equity : account.capital_initial;
        return [
          ...acc,
          {
            date: new Date(pos.exit_date!).toLocaleDateString('fr-FR'),
            equity: prevEquity + pos.pnl,
          },
        ];
      },
      []
    );

  const openPositions = positions.filter((p) => p.status === 'open');
  const closedPositions = positions.filter((p) => p.status === 'closed');

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-muted mb-1">Solde portefeuille</div>
          <div className="text-2xl font-semibold text-white tabular">
            {fmtFcfa(account.capital_current)}
          </div>
          <div className="text-xs text-muted mt-1">
            Initial: {fmtFcfa(account.capital_initial)}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-muted mb-1">P&L Total</div>
          <div
            className={`text-2xl font-semibold tabular ${
              account.pnl_total >= 0 ? 'text-up' : 'text-down'
            }`}
          >
            {fmtFcfa(account.pnl_total)}
          </div>
          <div
            className={`text-xs mt-1 ${
              account.pnl_pct >= 0 ? 'text-up' : 'text-down'
            }`}
          >
            {fmtNumber(account.pnl_pct, 2)}%
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-muted mb-1">Win Rate</div>
          <div className="text-2xl font-semibold text-info tabular">
            {stats ? fmtNumber(stats.winRate, 1) : 'N/A'}%
          </div>
          <div className="text-xs text-muted mt-1">
            {stats ? `${stats.winningTrades}/${stats.totalTrades} trades` : '—'}
          </div>
        </div>
      </div>

      {/* Equity Curve */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Courbe de performance
        </h3>
        {equityCurve.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232733" />
              <XAxis dataKey="date" stroke="#8b93a7" />
              <YAxis stroke="#8b93a7" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161922',
                  border: '1px solid #232733',
                }}
                labelStyle={{ color: '#e6e9f0' }}
                formatter={(value) => fmtFcfa(value as number)}
              />
              <Line
                type="monotone"
                dataKey="equity"
                stroke="#56D7FD"
                isAnimationActive={false}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted text-center py-8">Aucun trade complété</p>
        )}
      </div>

      {/* Trade Stats */}
      {stats && stats.totalTrades > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-xs text-muted mb-1">Avg Win</p>
            <p
              className={`text-lg font-semibold tabular ${
                stats.avgWin >= 0 ? 'text-up' : 'text-down'
              }`}
            >
              {fmtFcfa(stats.avgWin)}
            </p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-xs text-muted mb-1">Avg Loss</p>
            <p
              className={`text-lg font-semibold tabular ${
                stats.avgLoss >= 0 ? 'text-up' : 'text-down'
              }`}
            >
              {fmtFcfa(stats.avgLoss)}
            </p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-xs text-muted mb-1">Best Trade</p>
            <p className="text-lg font-semibold text-up tabular">
              {fmtFcfa(stats.bestTrade)}
            </p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-xs text-muted mb-1">Worst Trade</p>
            <p className="text-lg font-semibold text-down tabular">
              {fmtFcfa(stats.worstTrade)}
            </p>
          </div>
        </div>
      )}

      {/* Journal */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Journal de trades</h3>
        <PaperTradingJournal
          openPositions={openPositions}
          closedPositions={closedPositions}
        />
      </div>
    </div>
  );
}
