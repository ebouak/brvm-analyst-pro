'use client';

import { fmtNumber, fmtFcfa, fmtDateFR } from '@/lib/format';
import { Position, OpenPosition } from '@/lib/paper-trading/types';
import { useState } from 'react';

interface PaperTradingJournalProps {
  openPositions: OpenPosition[];
  closedPositions: Position[];
  /** Valeur totale du portefeuille (liquidités + positions) pour calculer le poids. */
  portfolioValue: number;
  onClose?: (id: string) => void;
  busy?: boolean;
}

const colorOf = (v: number) => (v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted');
const arrowOf = (v: number) => (v > 0 ? '▲' : v < 0 ? '▼' : '·');
const signed = (v: number, fmt: (n: number) => string) => `${v >= 0 ? '+' : ''}${fmt(v)}`;

export function PaperTradingJournal({
  openPositions,
  closedPositions,
  portfolioValue,
  onClose,
  busy,
}: PaperTradingJournalProps) {
  const [showOpen, setShowOpen] = useState(true);

  return (
    <div className="space-y-4">
      {/* Onglets */}
      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={showOpen}
          onClick={() => setShowOpen(true)}
          className={`px-4 py-2 rounded transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-info/50 ${
            showOpen ? 'bg-info text-bg' : 'bg-surface border border-border text-muted hover:text-white'
          }`}
        >
          Positions ouvertes ({openPositions.length})
        </button>
        <button
          type="button"
          aria-pressed={!showOpen}
          onClick={() => setShowOpen(false)}
          className={`px-4 py-2 rounded transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-info/50 ${
            !showOpen ? 'bg-info text-bg' : 'bg-surface border border-border text-muted hover:text-white'
          }`}
        >
          Trades fermés ({closedPositions.length})
        </button>
      </div>

      {showOpen ? (
        <OpenPositionsTable
          positions={openPositions}
          portfolioValue={portfolioValue}
          onClose={onClose}
          busy={busy}
        />
      ) : (
        <ClosedTradesTable trades={closedPositions} />
      )}
    </div>
  );
}

/* ─── Positions ouvertes : chaque ligne explique le P&L latent ─────────────── */
function OpenPositionsTable({
  positions,
  portfolioValue,
  onClose,
  busy,
}: {
  positions: OpenPosition[];
  portfolioValue: number;
  onClose?: (id: string) => void;
  busy?: boolean;
}) {
  if (positions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center">
        <p className="font-medium text-white">Aucune position ouverte</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
          Ouvrez une position fictive pour tester un signal. Vous suivrez ici, ligne par ligne,
          votre gain ou perte au cours du jour.
        </p>
      </div>
    );
  }

  const totInvested = positions.reduce((s, p) => s + p.entry_price * p.num_shares, 0);
  const totValue = positions.reduce((s, p) => s + p.current_value, 0);
  const totLatent = positions.reduce((s, p) => s + p.pnl, 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-elevated/40 text-xs text-muted">
            <th className="px-3 py-2.5 text-left font-semibold">Valeur</th>
            <th className="px-3 py-2.5 text-left font-semibold">Entrée</th>
            <th className="px-3 py-2.5 text-right font-semibold">Prix d’entrée</th>
            <th className="px-3 py-2.5 text-right font-semibold">Cours du jour</th>
            <th className="px-3 py-2.5 text-right font-semibold">Écart</th>
            <th className="px-3 py-2.5 text-right font-semibold">Qté</th>
            <th className="px-3 py-2.5 text-right font-semibold">Investi</th>
            <th className="px-3 py-2.5 text-right font-semibold">Valeur actuelle</th>
            <th className="px-3 py-2.5 text-right font-semibold">P&amp;L latent</th>
            <th className="px-3 py-2.5 text-right font-semibold">Poids</th>
            {onClose && <th className="px-3 py-2.5 text-right font-semibold sr-only">Action</th>}
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const invested = p.entry_price * p.num_shares;
            const weight = portfolioValue > 0 ? (p.current_value / portfolioValue) * 100 : 0;
            return (
              <tr key={p.id} className="border-b border-border/30 transition hover:bg-elevated/30">
                <td className="px-3 py-3 font-semibold text-white">{p.code}</td>
                <td className="px-3 py-3 text-xs text-muted">{fmtDateFR(p.entry_date)}</td>
                <td className="px-3 py-3 text-right tabular text-white">{fmtFcfa(p.entry_price)}</td>
                <td className="px-3 py-3 text-right tabular text-white">{fmtFcfa(p.current_price)}</td>
                <td className={`px-3 py-3 text-right tabular font-medium ${colorOf(p.pnl_pct)}`}>
                  {p.pnl_pct >= 0 ? '+' : ''}
                  {fmtNumber(p.pnl_pct, 1)}%
                </td>
                <td className="px-3 py-3 text-right tabular text-muted">{fmtNumber(p.num_shares, 0)}</td>
                <td className="px-3 py-3 text-right tabular text-muted">{fmtFcfa(invested)}</td>
                <td className="px-3 py-3 text-right tabular text-white">{fmtFcfa(p.current_value)}</td>
                <td className={`px-3 py-3 text-right tabular font-semibold ${colorOf(p.pnl)}`}>
                  <div>
                    {arrowOf(p.pnl)} {signed(p.pnl, fmtFcfa)}
                  </div>
                  <div className="text-[11px] font-normal opacity-80">
                    {p.pnl_pct >= 0 ? '+' : ''}
                    {fmtNumber(p.pnl_pct, 1)}%
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="tabular text-xs text-muted">{fmtNumber(weight, 0)}%</span>
                    <span className="hidden h-1 w-10 overflow-hidden rounded-full bg-border sm:block">
                      <span
                        className="block h-full bg-info/60"
                        style={{ width: `${Math.min(weight, 100)}%` }}
                      />
                    </span>
                  </div>
                </td>
                {onClose && (
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Fermer la position ${p.code}`}
                      onClick={() => onClose(p.id)}
                      className="rounded border border-down/40 px-3 py-1 text-xs text-down transition hover:bg-down/10 active:scale-95 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-down/50"
                    >
                      Fermer
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-elevated/30 text-xs">
            <td className="px-3 py-2.5 font-semibold text-muted" colSpan={6}>
              TOTAL
            </td>
            <td className="px-3 py-2.5 text-right tabular text-muted">{fmtFcfa(totInvested)}</td>
            <td className="px-3 py-2.5 text-right tabular text-white">{fmtFcfa(totValue)}</td>
            <td className={`px-3 py-2.5 text-right tabular font-semibold ${colorOf(totLatent)}`}>
              {arrowOf(totLatent)} {signed(totLatent, fmtFcfa)}
            </td>
            <td colSpan={onClose ? 2 : 1} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ─── Trades fermés : chaque ligne explique le P&L réalisé ─────────────────── */
function ClosedTradesTable({ trades }: { trades: Position[] }) {
  if (trades.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center">
        <p className="font-medium text-white">Aucun trade fermé</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
          Vos positions clôturées apparaîtront ici avec leur performance définitive
          (P&amp;L réalisé et rendement).
        </p>
      </div>
    );
  }

  const totRealized = trades.reduce((s, p) => s + p.pnl, 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-elevated/40 text-xs text-muted">
            <th className="px-3 py-2.5 text-left font-semibold">Valeur</th>
            <th className="px-3 py-2.5 text-left font-semibold">Entrée</th>
            <th className="px-3 py-2.5 text-left font-semibold">Sortie</th>
            <th className="px-3 py-2.5 text-right font-semibold">Durée</th>
            <th className="px-3 py-2.5 text-right font-semibold">Prix d’entrée</th>
            <th className="px-3 py-2.5 text-right font-semibold">Prix de sortie</th>
            <th className="px-3 py-2.5 text-right font-semibold">Qté</th>
            <th className="px-3 py-2.5 text-right font-semibold">Investi</th>
            <th className="px-3 py-2.5 text-right font-semibold">Encaissé</th>
            <th className="px-3 py-2.5 text-right font-semibold">P&amp;L réalisé</th>
            <th className="px-3 py-2.5 text-right font-semibold">Rendement</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((p) => {
            const invested = p.entry_price * p.num_shares;
            const cashed = (p.exit_price ?? 0) * p.num_shares;
            return (
              <tr key={p.id} className="border-b border-border/30 transition hover:bg-elevated/30">
                <td className="px-3 py-3 font-semibold text-white">{p.code}</td>
                <td className="px-3 py-3 text-xs text-muted">{fmtDateFR(p.entry_date)}</td>
                <td className="px-3 py-3 text-xs text-muted">
                  {p.exit_date ? fmtDateFR(p.exit_date) : '—'}
                </td>
                <td className="px-3 py-3 text-right tabular text-muted">
                  {p.days_held != null ? `${p.days_held} j` : '—'}
                </td>
                <td className="px-3 py-3 text-right tabular text-white">{fmtFcfa(p.entry_price)}</td>
                <td className="px-3 py-3 text-right tabular text-white">
                  {p.exit_price != null ? fmtFcfa(p.exit_price) : '—'}
                </td>
                <td className="px-3 py-3 text-right tabular text-muted">{fmtNumber(p.num_shares, 0)}</td>
                <td className="px-3 py-3 text-right tabular text-muted">{fmtFcfa(invested)}</td>
                <td className="px-3 py-3 text-right tabular text-white">{fmtFcfa(cashed)}</td>
                <td className={`px-3 py-3 text-right tabular font-semibold ${colorOf(p.pnl)}`}>
                  {arrowOf(p.pnl)} {signed(p.pnl, fmtFcfa)}
                </td>
                <td className={`px-3 py-3 text-right tabular font-medium ${colorOf(p.pnl_pct)}`}>
                  {p.pnl_pct >= 0 ? '+' : ''}
                  {fmtNumber(p.pnl_pct, 1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-elevated/30 text-xs">
            <td className="px-3 py-2.5 font-semibold text-muted" colSpan={9}>
              TOTAL réalisé
            </td>
            <td className={`px-3 py-2.5 text-right tabular font-semibold ${colorOf(totRealized)}`}>
              {arrowOf(totRealized)} {signed(totRealized, fmtFcfa)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
