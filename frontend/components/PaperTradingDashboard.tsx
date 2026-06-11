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

interface TradableAction { code: string; designation: string | null; cours_jour: number | null }

export function PaperTradingDashboard() {
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tradable, setTradable] = useState<TradableAction[]>([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [posData, statsData] = await Promise.all([
        paperTradingService.getPositions(),
        paperTradingService.getStats(),
      ]);
      setPositions(posData.positions);
      setAccount(posData.account);
      setStats(statsData.stats);
    } catch (err) {
      console.error('Failed to load paper trading data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Fermeture de la modale à la touche Échap
  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowModal(false); setError(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal]);

  async function openModal() {
    setError(null);
    setShowModal(true);
    if (tradable.length === 0) {
      try {
        const res = await fetch('/api/paper-trading/tradable');
        const json = await res.json();
        setTradable(json.actions ?? []);
      } catch {
        setError('Impossible de charger la liste des actions.');
      }
    }
  }

  async function handleOpen() {
    if (!selectedCode) return;
    setBusy(true);
    setError(null);
    try {
      await paperTradingService.openPosition(selectedCode);
      setShowModal(false);
      setSelectedCode('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'ouverture");
    } finally {
      setBusy(false);
    }
  }

  async function handleClose(id: string) {
    setBusy(true);
    try {
      await paperTradingService.closePosition(id);
      await load();
    } catch (err) {
      console.error('close failed', err);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8" aria-busy="true">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-4 space-y-3">
              <div className="animate-pulse h-3 w-24 bg-border rounded" />
              <div className="animate-pulse h-7 w-32 bg-border rounded" />
            </div>
          ))}
        </div>
        <div className="animate-pulse bg-surface border border-border rounded-lg h-72" />
      </div>
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
      {/* Barre d'action */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-muted">
          Ouvrez une position fictive (10% du capital) pour tester un signal au cours du jour.
        </p>
        <button
          type="button"
          onClick={openModal}
          className="bg-info hover:bg-info/90 text-bg font-medium px-4 py-2 rounded-lg transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-info/50"
        >
          + Ouvrir une position
        </button>
      </div>

      {/* Modale ouverture */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowModal(false); setError(null); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ouvrir une position"
            onClick={(e) => e.stopPropagation()}
            className="bg-elevated border border-border rounded-xl p-6 w-full max-w-md space-y-4"
          >
            <h3 className="text-lg font-semibold text-white">Ouvrir une position</h3>
            <div className="space-y-2">
              <label className="text-xs text-muted">Action</label>
              <select
                aria-label="Choisir une action à acheter"
                value={selectedCode}
                onChange={(e) => setSelectedCode(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-info/50"
              >
                <option value="">— Choisir une action —</option>
                {tradable.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} — {a.designation ?? ''} ({fmtNumber(a.cours_jour)} FCFA)
                  </option>
                ))}
              </select>
              {account && selectedCode && (() => {
                const a = tradable.find((x) => x.code === selectedCode);
                if (!a?.cours_jour) return null;
                const montant = account.capital_current * 0.1;
                const titres = montant / a.cours_jour;
                return (
                  <p className="text-xs text-muted">
                    Investissement : <span className="text-white tabular">{fmtFcfa(montant)}</span>{' '}
                    ≈ <span className="text-white tabular">{fmtNumber(titres, 1)}</span> titres
                  </p>
                );
              })()}
            </div>
            {error && <p className="text-xs text-down">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowModal(false); setError(null); }}
                className="px-4 py-2 rounded-lg border border-border text-muted hover:text-white transition text-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-border"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!selectedCode || busy}
                onClick={handleOpen}
                className="px-4 py-2 rounded-lg bg-info text-bg font-medium disabled:opacity-40 transition text-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-info/50"
              >
                {busy ? 'Ouverture…' : 'Ouvrir'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          onClose={handleClose}
          busy={busy}
        />
      </div>
    </div>
  );
}
