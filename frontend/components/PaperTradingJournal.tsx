'use client';

import { fmtNumber, fmtFcfa, fmtDateFR } from '@/lib/format';
import { Position } from '@/lib/paper-trading/types';
import { useState } from 'react';

interface PaperTradingJournalProps {
  openPositions: Position[];
  closedPositions: Position[];
  onClose?: (id: string) => void;
  busy?: boolean;
}

export function PaperTradingJournal({
  openPositions,
  closedPositions,
  onClose,
  busy,
}: PaperTradingJournalProps) {
  const [showOpen, setShowOpen] = useState(true);

  const positions = showOpen ? openPositions : closedPositions;

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={showOpen}
          onClick={() => setShowOpen(true)}
          className={`px-4 py-2 rounded transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-info/50 ${
            showOpen
              ? 'bg-info text-bg'
              : 'bg-surface border border-border text-muted hover:text-white'
          }`}
        >
          Positions ouvertes ({openPositions.length})
        </button>
        <button
          type="button"
          aria-pressed={!showOpen}
          onClick={() => setShowOpen(false)}
          className={`px-4 py-2 rounded transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-info/50 ${
            !showOpen
              ? 'bg-info text-bg'
              : 'bg-surface border border-border text-muted hover:text-white'
          }`}
        >
          Trades fermés ({closedPositions.length})
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-muted font-semibold">Code</th>
              <th className="px-4 py-2 text-muted font-semibold">Entrée</th>
              <th className="px-4 py-2 text-muted font-semibold text-right">
                Prix entrée
              </th>
              <th className="px-4 py-2 text-muted font-semibold text-right">
                Quantité
              </th>
              {showOpen && onClose && (
                <th className="px-4 py-2 text-muted font-semibold text-right">Action</th>
              )}
              {!showOpen && (
                <>
                  <th className="px-4 py-2 text-muted font-semibold text-right">
                    Prix sortie
                  </th>
                  <th className="px-4 py-2 text-muted font-semibold">Sortie</th>
                  <th className="px-4 py-2 text-muted font-semibold text-right">
                    P&L
                  </th>
                  <th className="px-4 py-2 text-muted font-semibold text-right">
                    %
                  </th>
                  <th className="px-4 py-2 text-muted font-semibold text-right">
                    Jours
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td
                  colSpan={showOpen ? (onClose ? 5 : 4) : 9}
                  className="px-4 py-4 text-center text-muted"
                >
                  Aucun trade
                </td>
              </tr>
            ) : (
              positions.map((pos) => (
                <tr
                  key={pos.id}
                  className="border-b border-border/30 hover:bg-elevated/30 transition"
                >
                  <td className="px-4 py-3 font-semibold text-white">
                    {pos.code}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {fmtDateFR(pos.entry_date)}
                  </td>
                  <td className="px-4 py-3 text-right tabular text-white">
                    {fmtFcfa(pos.entry_price)}
                  </td>
                  <td className="px-4 py-3 text-right tabular text-muted">
                    {fmtNumber(pos.num_shares, 0)}
                  </td>
                  {showOpen && onClose && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Fermer la position ${pos.code}`}
                        onClick={() => onClose(pos.id)}
                        className="text-xs px-3 py-1 rounded border border-down/40 text-down hover:bg-down/10 active:scale-95 transition disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-down/50"
                      >
                        Fermer
                      </button>
                    </td>
                  )}
                  {!showOpen && (
                    <>
                      <td className="px-4 py-3 text-right tabular text-white">
                        {pos.exit_price ? fmtFcfa(pos.exit_price) : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {pos.exit_date ? fmtDateFR(pos.exit_date) : '—'}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular font-semibold ${
                          pos.pnl >= 0 ? 'text-up' : 'text-down'
                        }`}
                      >
                        {fmtFcfa(pos.pnl)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular font-semibold ${
                          pos.pnl_pct >= 0 ? 'text-up' : 'text-down'
                        }`}
                      >
                        {fmtNumber(pos.pnl_pct, 2)}%
                      </td>
                      <td className="px-4 py-3 text-right tabular text-muted">
                        {pos.days_held || '—'}
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
